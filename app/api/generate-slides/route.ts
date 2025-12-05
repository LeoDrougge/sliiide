import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { SlideState } from '../../lib/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    const { notes, brief, slideAmountMode, slideAmountMin, slideAmountMax } = await request.json();

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
- title: Huvudrubriken för sliden (max 60 tecken) - Detta är huvudbudskapet och den viktiga informationen. Undvik ord över 15 tecken eftersom rubriktypsnittet är stort.
- bodyText: Huvudinnehållet (2-4 rader, separera med \\n för radbrytningar)
${slideCountInstruction}
${summaryInstruction}

VIKTIGA REGLER FÖR TEXTFÖRFINING:
- Du får INTE lägga till någon ny information
- Du får bara förbättra texten språkligt så att den passar en slidepresentation: kort, tydligt och rakt på sak
- Behåll betydelsen exakt som i originalet
- Inga exempel, inga förklaringar, inga nya ord som ändrar innehållet
- Förfina bara rytm, klarhet och läsbarhet

STRUKTUR OCH LÄSBARHET:
- Varje slide ska kunna läsas och förstås självständigt
- Rubrikerna ska hänga ihop som en logisk kedja – men varje rubrik ska också vara fullt begriplig på egen hand

VIKTIGT: 
- Första sliden ska vara en titelsida med temat för presentationen
  - overline: Sätt till tom sträng ("")
  - title: Huvudtemat/titeln för presentationen
  - bodyText: Lämna tom eller en kort beskrivning av vad presentationen handlar om
  - layout: "title"
- Om presentationen är längre än 5 slides, ska slide 2 använda "intro" layout och innehålla en sammanfattning av hela presentationen i ett stycke i bodyText. Denna slide fungerar som en översikt över innehållet.
  - layout: "intro" för slide 2 när presentationen är längre än 5 slides
  - title: Lämna tom (intro-layout använder inte title)
  - bodyText: En sammanfattande text i ett stycke som ger en översikt över presentationens huvudpunkter
- Slide 3 ska vara en innehållsförteckning (TOC) med avdelningsrubriker när presentationen är längre än 5 slides.
  - layout: "quadrant-1-2-large" för TOC-sliden
  - title: "Innehållsförteckning"
  - bodyText: Lista av avdelningsrubriker (en per rad, kommer att formateras som bullets)
- För att strukturera presentationen: använd "avdelare" layout för avdelningsrubriker (t.ex. "Del 1", "Strategi", "Resultat"). Dessa slides ska ha ljusgrå bakgrund och fungerar som avdelningar i presentationen.
  - layout: "avdelare" för avdelningsrubriker
  - title: Avdelningsrubriken
  - bodyText: Lämna tom eller kort beskrivning
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
    "title": "",
    "bodyText": "Sammanfattning av presentationen i ett stycke...",
    "layout": "intro"
  },
  {
    "overline": "",
    "title": "...",
    "bodyText": "...",
    "layout": "avdelare"
  },
  {
    "overline": "",
    "title": "...",
    "bodyText": "...",
    "layout": "title"
  },
  ...
]

Använd "title" som layout för vanliga slides, "avdelare" för avdelningsrubriker, och "intro" för slide 2 om presentationen är längre än 5 slides. Sätt overline till tom sträng (""). Returnera ENDAST JSON, ingen ytterligare text.`;

    // Add brief to prompt if provided
    let fullPrompt = prompt;
    if (brief && typeof brief === 'string' && brief.trim()) {
      fullPrompt = `BRIEF/KONTEXT:
${brief.trim()}

${prompt}`;
    }

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
            content: fullPrompt,
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

    // If more than 5 slides, ensure intro (slide 2) and TOC (slide 3) exist
    if (validatedSlides.length > 5) {
      const slide2 = validatedSlides[1]; // Slide 2 (index 1)
      const slide3 = validatedSlides[2]; // Slide 3 (index 2)
      
      // Ensure slide 2 is an intro slide
      if (!slide2 || slide2.layout !== 'intro') {
        // Create intro slide with summary - Claude should have created this,
        // but if not, we'll create a placeholder that needs manual editing
        const introSlide = {
          overline: titleSlideTitle,
          title: '',
          bodyText: slide2?.bodyText || 'Sammanfattning av presentationen kommer här...',
          layout: 'intro' as const,
          useBullets: false,
        };
        
        // Replace slide 2 with intro slide, or insert if missing
        if (slide2) {
          validatedSlides[1] = introSlide;
        } else {
          validatedSlides.splice(1, 0, introSlide);
        }
      }
      
      // Ensure slide 3 is a TOC slide (after intro)
      // Get titles from "avdelare" slides for TOC (section dividers)
      // Skip title slide (index 0) and intro slide (index 1), then filter for "avdelare" layout slides
      const tocTitles = validatedSlides
        .slice(2) // Skip title slide and intro slide
        .filter(slide => slide.layout === 'avdelare')
        .map(slide => slide.title)
        .filter(title => title.trim());

      // If no avdelare slides found, fall back to all slide titles (except title and intro slides)
      const finalTocTitles = tocTitles.length > 0 
        ? tocTitles 
        : validatedSlides
            .slice(2) // Skip title slide and intro slide
            .map(slide => slide.title)
            .filter(title => title.trim());

      // Check if slide 3 is already a TOC slide
      const isTocSlide = slide3?.title === 'Innehållsförteckning' || 
                         slide3?.layout === 'toc';

      if (!slide3 || !isTocSlide) {
        // Create TOC slide with same structure as validatedSlides
        const tocSlide = {
          overline: titleSlideTitle, // Use title slide's title as overline
          title: 'Innehållsförteckning',
          bodyText: finalTocTitles.join('\n'),
          layout: 'toc' as const,
          useBullets: false, // TOC uses numbered list, not bullets
        };

        // Replace slide 3 with TOC slide, or insert if missing
        if (slide3) {
          validatedSlides[2] = tocSlide;
        } else {
          validatedSlides.splice(2, 0, tocSlide);
        }
      } else {
        // Update existing TOC slide content
        slide3.bodyText = finalTocTitles.join('\n');
        slide3.layout = 'toc';
        slide3.useBullets = false; // TOC uses numbered list, not bullets
      }
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

