'use client';

import { useState } from 'react';
import Image from 'next/image';

interface RoomImageProps {
  src: string;
  alt: string;
  placeholderSrc: string;
}

export default function RoomImage({ src, alt, placeholderSrc }: RoomImageProps) {
  const [imgSrc, setImgSrc] = useState(src);

  return (
    <Image
      src={imgSrc}
      alt={alt}
      fill
      className="object-cover"
      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
      onError={() => setImgSrc(placeholderSrc)}
    />
  );
}
