import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { PublicHomeSection } from '@/types/common.types';
import { withAlpha, STOREFRONT_CONTAINER_CLASS, type StorefrontTheme } from '../storefrontTheme';
import { StorefrontMediaFrame } from '../StorefrontMediaFrame';
import { parseHomeSectionContent } from '@/features/homeSections/homeSections.mapper';
import { isColorDark } from '@/features/homeSections/promoBanner.types';
import {
  IMAGE_TEXT_ASPECT_CLASSES,
  IMAGE_TEXT_ROUNDED_CLASSES,
  IMAGE_TEXT_OVERLAY_ALPHAS,
  IMAGE_TEXT_TITLE_SIZE_CLASSES,
  IMAGE_TEXT_SUBTITLE_SIZE_CLASSES,
  IMAGE_TEXT_BUTTON_SIZE_CLASSES,
  IMAGE_TEXT_CONTENT_WIDTH_CLASSES,
  IMAGE_TEXT_SPACING_CLASSES,
  IMAGE_TEXT_BG_OPACITY_ALPHAS,
  IMAGE_TEXT_SECTION_SIZE_PADDING_CLASSES,
  imageTextContentPositionClasses,
  imageTextContentPositionParts,
  type ImageTextAspect,
  type ImageTextRounded,
  type ImageTextColorMode,
  type ImageTextContentPosition,
} from '@/features/homeSections/imageTextSection.types';
import type { Json } from '@/types/database.types';

interface ImageTextSectionRendererProps {
  section: PublicHomeSection;
  theme: StorefrontTheme;
}

function resolveTextColor(mode: ImageTextColorMode, custom: string | null, theme: StorefrontTheme): string {
  switch (mode) {
    case 'theme_muted':
      return theme.mutedText;
    case 'theme_primary':
      return theme.primary;
    case 'white':
      return '#ffffff';
    case 'black':
      return '#000000';
    case 'custom':
      return custom ?? theme.text;
    case 'theme_text':
    default:
      return theme.text;
  }
}

/** Everything a layout composition needs — resolved once at the top of the
 * renderer and threaded through, same "one bag of props" convention as
 * PromoBannersSectionRenderer's BannerProps. */
interface LayoutProps {
  section: PublicHomeSection;
  theme: StorefrontTheme;
  imageUrl: string | null;
  aspect: ImageTextAspect;
  rounded: ImageTextRounded;
  imagePosition: 'left' | 'right' | 'top' | 'bottom';
  overlay: 'none' | 'soft' | 'medium' | 'strong';
  contentPosition: ImageTextContentPosition;
  textAlign: 'left' | 'center' | 'right';
  contentWidth: 'narrow' | 'medium' | 'wide';
  spacing: 'compact' | 'normal' | 'relaxed';
  eyebrow: string | null;
  titleColor: string;
  subtitleColor: string;
  titleSize: 'sm' | 'md' | 'lg' | 'xl';
  subtitleSize: 'sm' | 'md' | 'lg';
  linkUrl: string | null;
  linkLabel: string | null;
  buttonAccent: string;
  buttonStyle: 'solid' | 'outline' | 'ghost';
  buttonSize: 'sm' | 'md' | 'lg';
  contentBgStyle: CSSProperties;
  contentBgClassName: string;
}

function ButtonEl({ props }: { props: LayoutProps }) {
  const { linkUrl, linkLabel, buttonAccent, buttonStyle, buttonSize, theme } = props;
  if (!linkUrl || !linkLabel) return null;
  const isExternal = linkUrl.startsWith('http');
  const accentIsDark = isColorDark(buttonAccent);

  function resolvePaint(): { className: string; style: CSSProperties } {
    switch (buttonStyle) {
      case 'outline':
        return { className: 'bg-transparent border-2', style: { borderColor: buttonAccent, color: buttonAccent } };
      case 'ghost':
        return { className: 'border-0 bg-transparent px-0 shadow-none', style: { color: buttonAccent } };
      case 'solid':
      default: {
        const onAccent = accentIsDark ? '#ffffff' : theme.mode === 'dark' ? '#0b0f19' : '#111827';
        return { className: 'border-0 shadow-sm', style: { backgroundColor: buttonAccent, color: onAccent } };
      }
    }
  }
  const { className: paintClassName, style: paintStyle } = resolvePaint();

  const className = `inline-flex w-fit items-center gap-1.5 rounded-full font-semibold transition-transform hover:scale-[1.02] ${IMAGE_TEXT_BUTTON_SIZE_CLASSES[buttonSize]} ${paintClassName}`;
  const content: ReactNode = (
    <>
      <span>{linkLabel}</span>
      <span aria-hidden>→</span>
    </>
  );

  return isExternal ? (
    <a href={linkUrl} target="_blank" rel="noopener noreferrer" className={className} style={paintStyle}>
      {content}
    </a>
  ) : (
    <Link to={linkUrl} className={className} style={paintStyle}>
      {content}
    </Link>
  );
}

function TextBlock({ props }: { props: LayoutProps }) {
  const { section, textAlign, contentWidth, spacing, eyebrow, titleColor, subtitleColor, titleSize, subtitleSize } = props;
  const alignClassName =
    textAlign === 'center' ? 'items-center text-center mx-auto' : textAlign === 'right' ? 'items-end text-right ml-auto' : 'items-start text-left';

  return (
    <div
      className={`flex flex-col ${IMAGE_TEXT_SPACING_CLASSES[spacing]} ${IMAGE_TEXT_CONTENT_WIDTH_CLASSES[contentWidth]} ${alignClassName}`}
    >
      {eyebrow && (
        <span
          className="inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
          style={{ backgroundColor: withAlpha(titleColor, 0.12), color: titleColor }}
        >
          {eyebrow}
        </span>
      )}
      {section.heading && (
        <h2 className={`font-bold tracking-tight ${IMAGE_TEXT_TITLE_SIZE_CLASSES[titleSize]}`} style={{ color: titleColor }}>
          {section.heading}
        </h2>
      )}
      {section.subheading && (
        <p className={IMAGE_TEXT_SUBTITLE_SIZE_CLASSES[subtitleSize]} style={{ color: subtitleColor }}>
          {section.subheading}
        </p>
      )}
      <ButtonEl props={props} />
    </div>
  );
}

function ImageBox({ props }: { props: LayoutProps }) {
  const { imageUrl, section, aspect, rounded, theme } = props;
  if (aspect === 'auto') {
    return imageUrl ? (
      <img
        src={imageUrl}
        alt={section.heading ?? ''}
        className={`h-auto w-full object-contain ${IMAGE_TEXT_ROUNDED_CLASSES[rounded]}`}
      />
    ) : (
      <div className={`aspect-[4/3] w-full ${IMAGE_TEXT_ROUNDED_CLASSES[rounded]}`} style={{ backgroundColor: theme.surfaceAlt }} />
    );
  }
  return (
    <StorefrontMediaFrame
      src={imageUrl}
      alt={section.heading ?? ''}
      aspectClassName={IMAGE_TEXT_ASPECT_CLASSES[aspect]}
      roundedClassName={IMAGE_TEXT_ROUNDED_CLASSES[rounded]}
      className="bg-transparent shadow-sm"
      imageClassName="h-full w-full object-cover"
      fallback={<div className="h-full w-full" style={{ backgroundColor: theme.surfaceAlt }} />}
    />
  );
}

/** Classic composition, generalized: `imagePosition` left/right splits into
 * side-by-side columns; top/bottom stacks the same column-style (aspect +
 * rounded) image above/below the text instead — distinct from the
 * `stacked` layout's edge-to-edge full-bleed image. */
function SideBySideLayout({ props }: { props: LayoutProps }) {
  const { imagePosition, textAlign } = props;
  const isVertical = imagePosition === 'top' || imagePosition === 'bottom';
  const imageFirst = imagePosition === 'left' || imagePosition === 'top';
  const justifyClassName =
    textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start';

  return (
    <div
      className={`mx-auto flex ${STOREFRONT_CONTAINER_CLASS} flex-col gap-8 lg:gap-14 ${
        isVertical ? '' : `md:items-center ${imagePosition === 'right' ? 'md:flex-row-reverse' : 'md:flex-row'}`
      }`}
    >
      <div className={`w-full ${isVertical ? '' : 'md:w-1/2'} ${imageFirst ? 'order-1' : 'order-2'}`}>
        <ImageBox props={props} />
      </div>
      <div
        className={`flex w-full ${isVertical ? '' : 'md:w-1/2'} ${imageFirst ? 'order-2' : 'order-1'} ${
          isVertical ? justifyClassName : imagePosition === 'right' ? 'md:justify-end' : 'md:justify-start'
        }`}
      >
        <TextBlock props={props} />
      </div>
    </div>
  );
}

/** Image fills the whole section as a backdrop; text sits in a free 9-grid
 * position over it with a legibility scrim scaled/aimed to that position —
 * same idea as PromoBannersSectionRenderer's image_focus composition. */
function BackgroundLayout({ props }: { props: LayoutProps }) {
  const { imageUrl, section, aspect, rounded, overlay, contentPosition, theme } = props;
  const alphas = IMAGE_TEXT_OVERLAY_ALPHAS[overlay];
  // A full-bleed backdrop needs a real height — 'auto' (meant for a
  // naturally-sized inline image) falls back to a wide/panoramic ratio
  // here instead of collapsing to nothing.
  const bgAspectClassName = IMAGE_TEXT_ASPECT_CLASSES[aspect === 'auto' ? 'wide' : aspect];

  function overlayStyle(): CSSProperties | undefined {
    if (!alphas) return undefined;
    const { vertical, horizontal } = imageTextContentPositionParts(contentPosition);
    const color = theme.text;
    if (vertical === 'top') {
      return { background: `linear-gradient(to bottom, ${withAlpha(color, alphas.from)}, ${withAlpha(color, alphas.to)} 60%, transparent)` };
    }
    if (vertical === 'bottom') {
      return { background: `linear-gradient(to top, ${withAlpha(color, alphas.from)}, ${withAlpha(color, alphas.to)} 60%, transparent)` };
    }
    const anchorX = horizontal === 'left' ? '25%' : horizontal === 'right' ? '75%' : '50%';
    return {
      background: `radial-gradient(ellipse 75% 65% at ${anchorX} 50%, ${withAlpha(color, alphas.from)}, ${withAlpha(color, alphas.to)} 55%, transparent 85%)`,
    };
  }

  return (
    <div className={`relative mx-auto ${STOREFRONT_CONTAINER_CLASS} overflow-hidden ${bgAspectClassName} ${IMAGE_TEXT_ROUNDED_CLASSES[rounded]}`}>
      <StorefrontMediaFrame
        src={imageUrl}
        alt={section.heading ?? ''}
        aspectClassName="h-full"
        roundedClassName="rounded-none"
        className="bg-transparent"
        imageClassName="h-full w-full object-cover"
        fallback={<div className="h-full w-full" style={{ backgroundColor: theme.surfaceAlt }} />}
      />
      <div
        className={`absolute inset-0 flex flex-col p-6 sm:p-10 ${imageTextContentPositionClasses(contentPosition)}`}
        style={overlayStyle()}
      >
        <TextBlock props={props} />
      </div>
    </div>
  );
}

/** Image edge-to-edge, full section width, text block stacked below/above
 * (per `imagePosition` bottom/top) and centered per textAlign/contentWidth
 * — the "hero-like but not exaggerated" full-width composition. */
function StackedLayout({ props }: { props: LayoutProps }) {
  const { imagePosition, textAlign } = props;
  const imageFirst = imagePosition !== 'bottom';
  const justifyClassName =
    textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start';

  const image = <ImageBox props={props} />;
  const text = (
    <div className={`flex w-full ${justifyClassName}`}>
      <TextBlock props={props} />
    </div>
  );

  return (
    <div className={`mx-auto flex ${STOREFRONT_CONTAINER_CLASS} flex-col gap-8`}>
      {imageFirst ? (
        <>
          {image}
          {text}
        </>
      ) : (
        <>
          {text}
          {image}
        </>
      )}
    </div>
  );
}

/** Editorial-card feel: the text panel overlaps the image's bottom edge,
 * painted per `contentBg`/`contentBgOpacity`/`contentBgBlur`. */
function CardOverlayLayout({ props }: { props: LayoutProps }) {
  const { contentBgStyle, contentBgClassName } = props;
  return (
    <div className={`relative mx-auto ${STOREFRONT_CONTAINER_CLASS}`}>
      <ImageBox props={props} />
      <div
        className={`relative mx-4 -mt-12 rounded-2xl p-6 sm:mx-10 sm:-mt-16 sm:p-8 ${contentBgClassName}`}
        style={contentBgStyle}
      >
        <TextBlock props={props} />
      </div>
    </div>
  );
}

export function ImageTextSectionRenderer({ section, theme }: ImageTextSectionRendererProps) {
  const content = parseHomeSectionContent('image_text', section.content as Json);
  if (content.sectionType !== 'image_text') return null;

  const {
    imageUrl,
    linkUrl,
    linkLabel,
    eyebrow,
    layout,
    imagePosition,
    aspect,
    rounded,
    overlay,
    contentPosition,
    titleSize,
    subtitleSize,
    buttonSize,
    titleColorMode,
    customTitleColor,
    subtitleColorMode,
    customSubtitleColor,
    buttonColorMode,
    customButtonColor,
    buttonStyle,
    textAlign,
    contentWidth,
    spacing,
    contentBg,
    customContentBgColor,
    contentBgOpacity,
    contentBgBlur,
    sectionBg,
    customSectionBgColor,
    sectionSize,
  } = content;

  const titleColor = resolveTextColor(titleColorMode, customTitleColor, theme);
  const subtitleColor = resolveTextColor(subtitleColorMode, customSubtitleColor, theme);
  const buttonAccent = resolveTextColor(buttonColorMode, customButtonColor, theme);

  const contentBgStyle: CSSProperties = (() => {
    if (contentBg === 'none') return {};
    const base =
      contentBg === 'white' ? '#ffffff' : contentBg === 'dark' ? '#111827' : contentBg === 'theme' ? theme.primary : customContentBgColor ?? theme.primary;
    return { backgroundColor: withAlpha(base, IMAGE_TEXT_BG_OPACITY_ALPHAS[contentBgOpacity]) };
  })();
  const contentBgClassName = contentBg !== 'none' && contentBgBlur ? 'backdrop-blur-md' : '';

  const sectionBgStyle: CSSProperties | undefined = (() => {
    switch (sectionBg) {
      case 'theme':
        return { backgroundColor: theme.secondary };
      case 'custom':
        return { backgroundColor: customSectionBgColor ?? theme.secondary };
      case 'gradient':
        return { backgroundImage: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` };
      case 'none':
      default:
        return undefined;
    }
  })();

  const layoutProps: LayoutProps = {
    section,
    theme,
    imageUrl,
    aspect,
    rounded,
    imagePosition,
    overlay,
    contentPosition,
    textAlign,
    contentWidth,
    spacing,
    eyebrow,
    titleColor,
    subtitleColor,
    titleSize,
    subtitleSize,
    linkUrl,
    linkLabel,
    buttonAccent,
    buttonStyle,
    buttonSize,
    contentBgStyle,
    contentBgClassName,
  };

  return (
    <section className={`px-4 sm:px-6 lg:px-8 ${IMAGE_TEXT_SECTION_SIZE_PADDING_CLASSES[sectionSize]}`} style={sectionBgStyle}>
      {layout === 'background' ? (
        <BackgroundLayout props={layoutProps} />
      ) : layout === 'stacked' ? (
        <StackedLayout props={layoutProps} />
      ) : layout === 'card_overlay' ? (
        <CardOverlayLayout props={layoutProps} />
      ) : (
        <SideBySideLayout props={layoutProps} />
      )}
    </section>
  );
}
