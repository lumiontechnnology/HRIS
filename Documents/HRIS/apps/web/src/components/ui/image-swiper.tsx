import React, { useEffect, useRef, useState, useCallback } from 'react';

interface ImageSwiperProps {
  images: string; cardWidth?: number; cardHeight?: number; className?: string;
}

export const ImageSwiper: React.FC<ImageSwiperProps> = ({
  images, cardWidth = 256, cardHeight = 352, className = ''
}) => {
  const cardStackRef = useRef<HTMLDivElement>(null);
  const isSwiping = useRef(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const animationFrameId = useRef<number | null>(null);
  const imageList = images.split(',').map(img => img.trim()).filter(img => img);
  const [cardOrder, setCardOrder] = useState<number[]>(() => Array.from({ length: imageList.length }, (_, i) => i));

  const getDurationFromCSS = useCallback((variableName: string, element?: HTMLElement | null): number => {
    const value = getComputedStyle(element || document.documentElement)?.getPropertyValue(variableName)?.trim();
    if (!value) return 0;
    if (value.endsWith("ms")) return parseFloat(value);
    if (value.endsWith("s")) return parseFloat(value) * 1000;
    return parseFloat(value) || 0;
  }, []);

  const getCards = useCallback((): HTMLElement[] => {
    if (!cardStackRef.current) return [];
    return [...cardStackRef.current.querySelectorAll('.image-card')] as HTMLElement[];
  }, []);

  const getActiveCard = useCallback((): HTMLElement | null => getCards()[0] || null, [getCards]);

  const updatePositions = useCallback(() => {
    getCards().forEach((card, i) => {
      card.style.setProperty('--i', (i + 1).toString());
      card.style.setProperty('--swipe-x', '0px');
      card.style.setProperty('--swipe-rotate', '0deg');
      card.style.opacity = '1';
    });
  }, [getCards]);

  const applySwipeStyles = useCallback((deltaX: number) => {
    const card = getActiveCard();
    if (!card) return;
    card.style.setProperty('--swipe-x', `${deltaX}px`);
    card.style.setProperty('--swipe-rotate', `${deltaX * 0.2}deg`);
    card.style.opacity = (1 - Math.min(Math.abs(deltaX) / 100, 1) * 0.75).toString();
  }, [getActiveCard]);

  const handleEnd = useCallback(() => {
    if (!isSwiping.current) return;
    if (animationFrameId.current) { cancelAnimationFrame(animationFrameId.current); animationFrameId.current = null; }
    const deltaX = currentX.current - startX.current;
    const duration = getDurationFromCSS('--card-swap-duration', cardStackRef.current);
    const card = getActiveCard();
    if (card) {
      card.style.transition = `transform ${duration}ms ease, opacity ${duration}ms ease`;
      if (Math.abs(deltaX) > 50) {
        const direction = Math.sign(deltaX);
        card.style.setProperty('--swipe-x', `${direction * 300}px`);
        card.style.setProperty('--swipe-rotate', `${direction * 20}deg`);
        setTimeout(() => { setCardOrder(prev => prev.length === 0 ? [] : [...prev.slice(1), prev[0]]); }, duration);
      } else { applySwipeStyles(0); }
    }
    isSwiping.current = false;
    startX.current = 0;
    currentX.current = 0;
  }, [getDurationFromCSS, getActiveCard, applySwipeStyles]);

  const handleStart = useCallback((clientX: number) => {
    if (isSwiping.current) return;
    isSwiping.current = true;
    startX.current = clientX;
    currentX.current = clientX;
    const card = getActiveCard();
    if (card) card.style.transition = 'none';
  }, [getActiveCard]);

  const handleMove = useCallback((clientX: number) => {
    if (!isSwiping.current) return;
    if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    animationFrameId.current = requestAnimationFrame(() => {
      currentX.current = clientX;
      applySwipeStyles(currentX.current - startX.current);
      if (Math.abs(currentX.current - startX.current) > 50) handleEnd();
    });
  }, [applySwipeStyles, handleEnd]);

  useEffect(() => {
    const el = cardStackRef.current;
    if (!el) return;
    const down = (e: PointerEvent) => handleStart(e.clientX);
    const move = (e: PointerEvent) => handleMove(e.clientX);
    const up = () => handleEnd();
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
  }, [handleStart, handleMove, handleEnd]);

  useEffect(() => { updatePositions(); }, [cardOrder, updatePositions]);

  return (
    <section className={`relative grid place-content-center select-none ${className}`} ref={cardStackRef}
      style={{ width: cardWidth + 32, height: cardHeight + 32, touchAction: 'none', '--card-swap-duration': '0.3s' } as React.CSSProperties}>
      {cardOrder.map((originalIndex, displayIndex) => (
        <article key={`${imageList[originalIndex]}-${originalIndex}`}
          className="image-card absolute cursor-grab active:cursor-grabbing place-self-center border border-border rounded-md overflow-hidden will-change-transform"
          style={{
            '--i': (displayIndex + 1).toString(), zIndex: imageList.length - displayIndex,
            width: cardWidth, height: cardHeight,
            transform: `perspective(700px) translateZ(calc(-1 * 12px * var(--i))) translateY(calc(7px * var(--i))) translateX(var(--swipe-x, 0px)) rotateY(var(--swipe-rotate, 0deg))`
          } as React.CSSProperties}>
          <img src={imageList[originalIndex]} alt={`Card ${originalIndex + 1}`}
            className="w-full h-full object-cover select-none pointer-events-none" draggable={false} />
        </article>
      ))}
    </section>
  );
};
