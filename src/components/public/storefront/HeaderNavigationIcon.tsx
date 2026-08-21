import {
  BadgePercent,
  FolderTree,
  Home,
  Heart,
  Layers3,
  List,
  SlidersHorizontal,
  Sparkles,
  ShoppingBag,
  Star,
  Tag,
  Dumbbell,
  Grid2X2,
} from 'lucide-react';
import type { HeaderNavigationIconKey, HeaderNavigationItemType } from '@/types/common.types';

type HeaderNavigationIconType = HeaderNavigationItemType | 'home';

interface HeaderNavigationIconProps {
  type: HeaderNavigationIconType;
  icon?: HeaderNavigationIconKey | null;
  iconUrl?: string | null;
  className?: string;
}

/** One consistent icon language for desktop, mobile and overflow navigation. */
export function HeaderNavigationIcon({ type, icon, iconUrl, className = 'h-5 w-5' }: HeaderNavigationIconProps) {
  if (iconUrl) {
    return <img src={iconUrl} alt="" aria-hidden="true" className={`${className} object-contain`} />;
  }

  const iconProps = { className, 'aria-hidden': true } as const;
  const iconKey = icon ?? (
    type === 'home' ? 'home' :
      type === 'category' ? 'folder-tree' :
        type === 'collection' ? 'layers' :
          type === 'facet_value' ? 'sliders' :
            type === 'featured' ? 'sparkles' :
              type === 'sale' ? 'badge-percent' :
                type === 'catalog' ? 'shopping-bag' : 'grid'
  );
  if (iconKey === 'home') return <Home {...iconProps} />;
  if (iconKey === 'shopping-bag') return <ShoppingBag {...iconProps} />;
  if (iconKey === 'folder-tree') return <FolderTree {...iconProps} />;
  if (iconKey === 'layers') return <Layers3 {...iconProps} />;
  if (iconKey === 'sliders') return <SlidersHorizontal {...iconProps} />;
  if (iconKey === 'sparkles') return <Sparkles {...iconProps} />;
  if (iconKey === 'badge-percent') return <BadgePercent {...iconProps} />;
  if (iconKey === 'star') return <Star {...iconProps} />;
  if (iconKey === 'heart') return <Heart {...iconProps} />;
  if (iconKey === 'tag') return <Tag {...iconProps} />;
  if (iconKey === 'dumbbell') return <Dumbbell {...iconProps} />;
  if (iconKey === 'grid') return <Grid2X2 {...iconProps} />;
  return <List {...iconProps} />;
}
