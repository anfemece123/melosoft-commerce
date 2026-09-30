import type { PublicCategoryExperience } from '@/types/common.types';
import {
  buildExperienceBackdropStyle,
  experienceHasDecoratedBackground,
} from '@/lib/storefront/experienceAmbience';

interface ExperienceBackdropProps {
  experience: PublicCategoryExperience | null;
}

/** Fixed decorative layer painted behind every public page while an
 * experience is active. The parent must be `isolate` so the negative
 * z-index stays above the shell background but below the content. Keyed by
 * experience so switching restaurants replays the fade-in. */
export function ExperienceBackdrop({ experience }: ExperienceBackdropProps) {
  if (!experience || !experienceHasDecoratedBackground(experience)) return null;

  return (
    <div
      key={experience.id}
      aria-hidden="true"
      data-testid="experience-backdrop"
      className="storefront-ambience pointer-events-none fixed inset-0 -z-10"
      style={buildExperienceBackdropStyle(experience)}
    />
  );
}
