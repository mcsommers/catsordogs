import type { RefObject } from 'react';
import type { ScrollView, View } from 'react-native';

export function scrollScreenToEnd(scrollRef: RefObject<ScrollView | null>) {
  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
}

/** Scroll so a field inside a `Screen scroll` sits near the top of the viewport. */
export function scrollToFieldInScreen(
  scrollRef: RefObject<ScrollView | null>,
  contentRef: RefObject<View | null>,
  fieldRef: RefObject<View | null>,
  offsetTop = 20
) {
  requestAnimationFrame(() => {
    const scroll = scrollRef.current;
    const content = contentRef.current;
    const field = fieldRef.current;
    if (!scroll || !content || !field) return;
    field.measureLayout(
      content,
      (_x, y) => scroll.scrollTo({ y: Math.max(0, y - offsetTop), animated: true }),
      () => scrollScreenToEnd(scrollRef)
    );
  });
}
