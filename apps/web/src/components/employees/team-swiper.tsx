'use client';

import { ImageSwiper } from '@/components/ui/image-swiper';

interface TeamSwiperProps {
  imageUrls: string[];
}

export function TeamSwiper({ imageUrls }: TeamSwiperProps): JSX.Element | null {
  if (!imageUrls.length) {
    return null;
  }

  return <ImageSwiper images={imageUrls.join(',')} cardWidth={210} cardHeight={280} className="mx-auto" />;
}
