import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';
import { gsap } from 'gsap';

export function useLandingMotion(root: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) {
          gsap.fromTo(entry.target, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .65, ease: 'power3.out', clearProps: 'transform,opacity' });
          observer.unobserve(entry.target);
        }
      }, { threshold: .12 });
      element.querySelectorAll('[data-reveal]').forEach(node => observer.observe(node));
      const enter = (event: Event) => {
        if (event.type === 'pointerover' && !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        const target = (event.target as HTMLElement).closest<HTMLElement>('[data-hover-lift]');
        const related = (event as PointerEvent).relatedTarget;
        if (target && (!(related instanceof Node) || !target.contains(related))) {
          gsap.to(target, { y: -3, duration: .28, ease: 'power2.out', overwrite: 'auto' });
        }
      };
      const leave = (event: Event) => {
        const target = (event.target as HTMLElement).closest<HTMLElement>('[data-hover-lift]');
        const related = (event as PointerEvent).relatedTarget;
        if (target && (!(related instanceof Node) || !target.contains(related))) gsap.to(target, { y: 0, duration: .35, ease: 'power2.out', overwrite: 'auto' });
      };
      element.addEventListener('pointerover', enter); element.addEventListener('pointerout', leave);
      element.addEventListener('focusin', enter); element.addEventListener('focusout', leave);
      return () => {
        observer.disconnect();
        element.removeEventListener('pointerover', enter); element.removeEventListener('pointerout', leave);
        element.removeEventListener('focusin', enter); element.removeEventListener('focusout', leave);
        gsap.killTweensOf(element.querySelectorAll('[data-reveal], [data-hover-lift]'));
        gsap.set(element.querySelectorAll('[data-reveal], [data-hover-lift]'), { clearProps: 'transform,opacity' });
      };
    }, element);
    return () => media.revert();
  }, [root]);
}
