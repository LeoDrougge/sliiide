import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { SlideState } from '../../lib/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    const { notes, slideAmountMode, slideAmountMin, slideAmountMax } = await request.json();

    if (!notes || typeof notes !== 'string' || !notes.trim()) {
      return NextResponse.json(
        { error: 'Notes are required' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // Build prompt with slide count instruction
    let slideCountInstruction = '';
    let summaryInstruction = '';
    if (slideAmountMode === 'edit' && typeof slideAmountMin === 'number' && typeof slideAmountMax === 'number' 
        && slideAmountMin >= 3 && slideAmountMax <= 32 && slideAmountMin <= slideAmountMax) {
      if (slideAmountMin === slideAmountMax) {
        slideCountInstruction = `\nVIKTIGT: Generera EXAKT ${slideAmountMin} slides. Inte fler, inte färre.`;
        summaryInstruction = `\nVIKTIGT: Om innehållet är omfattande (t.ex. många bullet points eller lång text), sammanfatta HÅRT för att passa in i exakt ${slideAmountMin} slides. Kombinera relaterade punkter, sammanfatta detaljer till huvudbudskap, och prioritera det viktigaste innehållet. Det är viktigare att få exakt ${slideAmountMin} slides än att behålla all detaljnivå.`;
      } else {
        slideCountInstruction = `\nVIKTIGT: Generera mellan ${slideAmountMin} och ${slideAmountMax} slides. Antalet ska ligga inom detta spann.`;
        summaryInstruction = `\nVIKTIGT: Om innehållet är omfattande (t.ex. många bullet points eller lång text), sammanfatta vid behov för att passa in i mellan ${slideAmountMin} och ${slideAmountMax} slides. Kombinera relaterade punkter, sammanfatta detaljer till huvudbudskap, och prioritera det viktigaste innehållet. Det är viktigare att få antalet slides inom spannet (${slideAmountMin}-${slideAmountMax}) än att behålla all detaljnivå.`;
      }
    } else {
      slideCountInstruction = '\nVIKTIGT: Dela upp logiskt i separata slides baserat på ämnen/avsnitt. Gör minimala anpassningar och använd innehållet som det är.';
      summaryInstruction = '\nVIKTIGT: Sammanfatta MINIMALT - använd primärt innehållet som det är.';
    }

    const prompt = `Du ska dela upp dessa anteckningar i slides för en presentation. Varje slide ska ha:
- overline: Denna kommer automatiskt att sättas till samma som title-sidan (första sliden). Du behöver inte bekymra dig om denna - sätt den alltid till tom sträng ("").
- title: Huvudrubriken för sliden (max 60 tecken) - Detta är huvudbudskapet och den viktiga informationen.
- bodyText: Huvudinnehållet (2-4 rader, separera med \\n för radbrytningar)
${slideCountInstruction}
${summaryInstruction}

VIKTIGT: 
- Första sliden ska vara en titelsida med temat för presentationen
  - overline: Sätt till tom sträng ("")
  - title: Huvudtemat/titeln för presentationen
  - bodyText: Lämna tom eller en kort beskrivning av vad presentationen handlar om
- Övriga slides: Använd faktiskt innehåll från anteckningarna, hitta inte på saker
- Sätt alltid overline till tom sträng (""). Den kommer automatiskt att uppdateras i systemet.

Anteckningar:
${notes}

Returnera JSON-array med SlideState objekt i formatet:
[
  {
    "overline": "",
    "title": "...",
    "bodyText": "...",
    "layout": "title"
  },
  {
    "overline": "",
    "title": "...",
    "bodyText": "...",
    "layout": "title"
  },
  ...
]

Använd "title" som layout för alla slides. Sätt overline till tom sträng (""). Returnera ENDAST JSON, ingen ytterligare text.`;

    // Try Claude 4.5 Sonnet first, then fallback to 3.5
    let message;
    const modelsToTry = [
      'claude-sonnet-4-5',
      'claude-sonnet-4-5-20241022',
      'claude-4-5-sonnet',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620',
      'claude-3-5-sonnet',
    ];

    let lastError: any = null;
    for (const model of modelsToTry) {
      try {
        message = await anthropic.messages.create({
          model: model,
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });
        console.log(`Successfully used model: ${model}`);
        break; // Success, exit loop
      } catch (error: any) {
        lastError = error;
        console.warn(`Failed with ${model}, trying next...`, error.message);
        continue;
      }
    }

    if (!message) {
      throw new Error(`All models failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Extract JSON from response (might have markdown code blocks)
    let jsonText = content.text.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/g, '').trim();
    }
    
    // Try to extract JSON array if there's extra text
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    let slides: SlideState[];
    try {
      slides = JSON.parse(jsonText) as SlideState[];
    } catch (parseError: any) {
      console.error('JSON parse error:', parseError);
      console.error('Text to parse:', jsonText.substring(0, 500));
      throw new Error(`Failed to parse Claude response as JSON: ${parseError.message}`);
    }
    
    if (!Array.isArray(slides) || slides.length === 0) {
      throw new Error('Claude did not return a valid array of slides');
    }
    
    // Validate and set default layout if missing
    const validatedSlides = slides.map((slide, index) => {
      if (!slide || typeof slide !== 'object') {
        throw new Error(`Invalid slide at index ${index}`);
      }
      return {
        overline: slide.overline || '',
        title: slide.title || '',
        bodyText: slide.bodyText || '',
        layout: slide.layout || 'title',
        useBullets: slide.useBullets ?? false,
      };
    });

    // Set overline on all slides to match title slide's title
    const titleSlideTitle = validatedSlides[0]?.title || '';
    validatedSlides.forEach((slide) => {
      slide.overline = titleSlideTitle;
    });

    // If more than 5 slides, insert Table of Contents as slide 2 (index 1)
    if (validatedSlides.length > 5) {
      // Get titles from slides for TOC
      // Skip title slide (index 0), then include all others
      const tocTitles = validatedSlides
        .slice(1) // Skip title slide
        .map(slide => slide.title)
        .filter(title => title.trim());

      // Create TOC slide with same structure as validatedSlides
      const tocSlide = {
        overline: titleSlideTitle, // Use title slide's title as overline
        title: 'Innehållsförteckning',
        bodyText: tocTitles.join('\n'),
        layout: 'quadrant-1-2-large' as const,
        useBullets: true,
      };

      // Insert TOC as slide 2 (index 1)
      validatedSlides.splice(1, 0, tocSlide);
    }

    return NextResponse.json({ slides: validatedSlides });
  } catch (error: any) {
    console.error('Error in generate-slides API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate slides' },
      { status: 500 }
    );
  }
}

