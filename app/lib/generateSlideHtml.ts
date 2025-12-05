import type { SlideState } from './types';
import { getLayoutStyles } from './htmlSlideLayouts';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper to convert CSS properties object to string
function styleToString(styles: Record<string, string | number | undefined>): string {
  return Object.entries(styles)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssKey}: ${value};`;
    })
    .join(' ');
}

export function generateSlideHtml(slide: SlideState, showGrid: boolean = false): string {
  const layoutStyles = getLayoutStyles(slide);
  
  const headerStyle = styleToString(layoutStyles.header);
  const titleStyle = styleToString(layoutStyles.title);
  const bodyStyle = styleToString(layoutStyles.body);

  const gridClass = showGrid ? '' : 'hidden';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @font-face {
            font-family: 'TT Norms';
            src: url('/fonts/TypeType - TT Norms Regular.ttf') format('truetype');
            font-weight: 400;
            font-style: normal;
        }
        @font-face {
            font-family: 'TT Norms';
            src: url('/fonts/TypeType - TT Norms Bold.ttf') format('truetype');
            font-weight: 700;
            font-style: normal;
        }
        @font-face {
            font-family: 'Martian Mono';
            src: url('/fonts/MartianMono-Regular.ttf') format('truetype');
            font-weight: 400;
            font-style: normal;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 0;
            background: white;
        }

        .slide-wrapper {
            position: relative;
            width: 1920px;
            height: 1080px;
            overflow: hidden;
        }

        .slide-frame {
            position: absolute;
            width: 1920px;
            height: 1080px;
            top: 0;
            left: 0;
            background: white;
            transform: none;
        }

        .grid-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: 
                linear-gradient(to right, rgba(0, 0, 0, 0.1) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(0, 0, 0, 0.1) 1px, transparent 1px);
            background-size: 40px 40px;
            pointer-events: none;
            z-index: 1;
        }

        .grid-overlay.hidden {
            display: none;
        }

        .grid-overlay::before,
        .grid-overlay::after {
            content: '';
            position: absolute;
            background: rgba(0, 0, 255, 0.3);
        }

        .grid-overlay::before {
            left: 50%;
            top: 0;
            width: 1px;
            height: 100%;
            transform: translateX(-50%);
        }

        .grid-overlay::after {
            top: 50%;
            left: 0;
            width: 100%;
            height: 1px;
            transform: translateY(-50%);
        }

        .slide-content {
            position: relative;
            z-index: 2;
            width: 100%;
            height: 100%;
        }

        .slide-header {
            font-family: 'Martian Mono', monospace;
            font-size: 16px;
            color: #000;
        }

        .slide-title {
            font-family: 'TT Norms', sans-serif;
            font-weight: 700;
            font-size: 125px;
            line-height: 125px;
            letter-spacing: -5px;
            color: #000;
        }

        .slide-body {
            font-family: 'TT Norms', sans-serif;
            font-size: 22px;
            line-height: 27px;
            letter-spacing: -0.66px;
            color: #000;
        }

        .slide-body-large {
            font-family: 'TT Norms', sans-serif;
            font-weight: 400;
            font-size: 30px;
            line-height: 42px;
            letter-spacing: -0.6px; /* -2% of 30px */
            color: #000;
        }

        /* Bullet list styles */
        .slide-bullet-list {
            list-style: none;
            padding-left: 0;
            margin: 0;
        }

        .slide-bullet-list li {
            position: relative;
            padding-left: 30px; /* Space for bullet (14px bullet + 16px margin) */
            margin-bottom: 0;
            line-height: inherit;
        }

        .slide-bullet-list li::before {
            content: '';
            display: inline-block;
            width: 14px;
            height: 14px;
            margin-right: 16px;
            background-image: url('/images/bullet.svg');
            background-size: 14px 14px;
            background-repeat: no-repeat;
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
        }

        .slide-logo {
            position: absolute;
            bottom: 40px;
            right: 40px;
            height: 40px;
            width: auto;
            z-index: 3;
            pointer-events: none;
        }

        @page {
            size: 1920px 1080px;
            margin: 0;
        }
    </style>
</head>
<body>
    <div class="slide-wrapper">
        <div class="slide-frame">
            <div class="grid-overlay ${gridClass}"></div>
            <div class="slide-content">
                <img src="/images/antrop_logo.svg" alt="Antrop" class="slide-logo" />
                <div class="slide-header" style="${headerStyle}">${escapeHtml(slide.header)}</div>
                <div class="slide-title" style="${titleStyle}">
                    ${layoutStyles.titleLines 
                      ? layoutStyles.titleLines.map(line => `<div style="line-height: 125px;">${escapeHtml(line)}</div>`).join('')
                      : escapeHtml(slide.title)}
                </div>
                ${layoutStyles.bodyUseBullets
                  ? `<ul class="slide-bullet-list ${layoutStyles.bodyClassName || 'slide-body'}" style="${bodyStyle}">
                      ${slide.bodyText.split('\n').filter(line => line.trim()).map(line => 
                        `<li>${escapeHtml(line)}</li>`
                      ).join('')}
                    </ul>`
                  : `<div class="${layoutStyles.bodyClassName || 'slide-body'}" style="${bodyStyle}">
                      ${layoutStyles.bodyLines
                        ? layoutStyles.bodyLines.map(paragraph => 
                            `<div>${paragraph.map(line => `<div style="line-height: ${layoutStyles.bodyLineHeight || 27}px;">${escapeHtml(line)}</div>`).join('')}</div>`
                          ).join('')
                        : slide.bodyText.split('\n').map(line => `<div>${escapeHtml(line)}</div>`).join('')}
                    </div>`
                }
            </div>
        </div>
    </div>
</body>
</html>
  `.trim();
}

export function generateMultiSlideHtml(slides: SlideState[], showGrid: boolean = false): string {
  // For multi-page, generate HTML with page breaks
  const slidesHtml = slides.map(slide => {
    const layoutStyles = getLayoutStyles(slide);

    const headerStyle = styleToString(layoutStyles.header);
    const titleStyle = styleToString(layoutStyles.title);
    const bodyStyle = styleToString(layoutStyles.body);

    const gridClass = showGrid ? '' : 'hidden';

    return `
      <div class="slide-page">
        <div class="slide-wrapper">
          <div class="slide-frame">
            <div class="grid-overlay ${gridClass}"></div>
            <div class="slide-content">
              <img src="/images/antrop_logo.svg" alt="Antrop" class="slide-logo" />
              <div class="slide-header" style="${headerStyle}">${escapeHtml(slide.header)}</div>
              <div class="slide-title" style="${titleStyle}">
                ${layoutStyles.titleLines 
                  ? layoutStyles.titleLines.map(line => `<div style="line-height: 125px;">${escapeHtml(line)}</div>`).join('')
                  : escapeHtml(slide.title)}
              </div>
              ${layoutStyles.bodyUseBullets
                ? `<ul class="slide-bullet-list ${layoutStyles.bodyClassName || 'slide-body'}" style="${bodyStyle}">
                    ${slide.bodyText.split('\n').filter(line => line.trim()).map(line => 
                      `<li>${escapeHtml(line)}</li>`
                    ).join('')}
                  </ul>`
                : `<div class="${layoutStyles.bodyClassName || 'slide-body'}" style="${bodyStyle}">
                    ${layoutStyles.bodyLines
                      ? layoutStyles.bodyLines.map(paragraph => 
                          `<div>${paragraph.map(line => `<div style="line-height: ${layoutStyles.bodyLineHeight || 27}px;">${escapeHtml(line)}</div>`).join('')}</div>`
                        ).join('')
                      : slide.bodyText.split('\n').map(line => `<div>${escapeHtml(line)}</div>`).join('')}
                  </div>`
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @font-face {
            font-family: 'TT Norms';
            src: url('/fonts/TypeType - TT Norms Regular.ttf') format('truetype');
            font-weight: 400;
            font-style: normal;
        }
        @font-face {
            font-family: 'TT Norms';
            src: url('/fonts/TypeType - TT Norms Bold.ttf') format('truetype');
            font-weight: 700;
            font-style: normal;
        }
        @font-face {
            font-family: 'Martian Mono';
            src: url('/fonts/MartianMono-Regular.ttf') format('truetype');
            font-weight: 400;
            font-style: normal;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 0;
            background: white;
        }

        .slide-page {
            width: 1920px;
            height: 1080px;
            page-break-after: always;
            position: relative;
        }

        .slide-wrapper {
            position: relative;
            width: 1920px;
            height: 1080px;
            overflow: hidden;
        }

        .slide-frame {
            position: absolute;
            width: 1920px;
            height: 1080px;
            top: 0;
            left: 0;
            background: white;
            transform: none;
        }

        .grid-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: 
                linear-gradient(to right, rgba(0, 0, 0, 0.1) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(0, 0, 0, 0.1) 1px, transparent 1px);
            background-size: 40px 40px;
            pointer-events: none;
            z-index: 1;
        }

        .grid-overlay.hidden {
            display: none;
        }

        .grid-overlay::before,
        .grid-overlay::after {
            content: '';
            position: absolute;
            background: rgba(0, 0, 255, 0.3);
        }

        .grid-overlay::before {
            left: 50%;
            top: 0;
            width: 1px;
            height: 100%;
            transform: translateX(-50%);
        }

        .grid-overlay::after {
            top: 50%;
            left: 0;
            width: 100%;
            height: 1px;
            transform: translateY(-50%);
        }

        .slide-content {
            position: relative;
            z-index: 2;
            width: 100%;
            height: 100%;
        }

        .slide-header {
            font-family: 'Martian Mono', monospace;
            font-size: 16px;
            color: #000;
        }

        .slide-title {
            font-family: 'TT Norms', sans-serif;
            font-weight: 700;
            font-size: 125px;
            line-height: 125px;
            letter-spacing: -5px;
            color: #000;
        }

        .slide-body {
            font-family: 'TT Norms', sans-serif;
            font-size: 22px;
            line-height: 27px;
            letter-spacing: -0.66px;
            color: #000;
        }

        .slide-body-large {
            font-family: 'TT Norms', sans-serif;
            font-weight: 400;
            font-size: 30px;
            line-height: 42px;
            letter-spacing: -0.6px; /* -2% of 30px */
            color: #000;
        }

        /* Bullet list styles */
        .slide-bullet-list {
            list-style: none;
            padding-left: 0;
            margin: 0;
        }

        .slide-bullet-list li {
            position: relative;
            padding-left: 30px; /* Space for bullet (14px bullet + 16px margin) */
            margin-bottom: 0;
            line-height: inherit;
        }

        .slide-bullet-list li::before {
            content: '';
            display: inline-block;
            width: 14px;
            height: 14px;
            margin-right: 16px;
            background-image: url('/images/bullet.svg');
            background-size: 14px 14px;
            background-repeat: no-repeat;
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
        }

        .slide-logo {
            position: absolute;
            bottom: 40px;
            right: 40px;
            height: 40px;
            width: auto;
            z-index: 3;
            pointer-events: none;
        }

        @page {
            size: 1920px 1080px;
            margin: 0;
        }
    </style>
</head>
<body>
    ${slidesHtml}
</body>
</html>
  `.trim();
}
