import { createContext, useCallback, useContext, type RefObject } from 'react';
import { Keyboard, Platform, type ScrollView, type View } from 'react-native';

const KEYBOARD_GAP = 20;

/** Distance from the top of the visible scroll viewport to the field label on focus. */
export const FIELD_LABEL_VIEWPORT_TOP = 30;

let lastKeyboardScreenY: number | null = null;
let keyboardTracking = false;

function ensureKeyboardTracking() {
  if (keyboardTracking) return;
  keyboardTracking = true;
  const onShow = (e: { endCoordinates: { screenY: number } }) => {
    lastKeyboardScreenY = e.endCoordinates.screenY;
  };
  const onHide = () => {
    lastKeyboardScreenY = null;
  };
  Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', onShow);
  Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', onHide);
}

type FormScrollValue = {
  scrollRef: RefObject<ScrollView | null>;
  contentRef: RefObject<View | null>;
} | null;

export const FormScrollContext = createContext<FormScrollValue>(null);

export function useFormScroll() {
  return useContext(FormScrollContext);
}

export function useScrollOnFieldFocus(fieldRef: RefObject<View | null>) {
  const ctx = useFormScroll();
  return useCallback(() => {
    if (!ctx) return;
    scrollToFieldInScreen(ctx.scrollRef, ctx.contentRef, fieldRef, FIELD_LABEL_VIEWPORT_TOP);
  }, [ctx, fieldRef]);
}

export function scrollScreenToEnd(scrollRef: RefObject<ScrollView | null>) {
  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
}

/** Keep scroll position after modal flows (e.g. image picker) that confuse keyboard insets on iOS. */
export function restoreScrollY(scrollRef: RefObject<ScrollView | null>, y: number) {
  Keyboard.dismiss();
  const delay = Platform.OS === 'ios' ? 80 : 0;
  setTimeout(() => scrollRef.current?.scrollTo({ y, animated: false }), delay);
}

function scrollFieldToVisible(
  scroll: ScrollView,
  content: View,
  field: View,
  keyboardTop: number | null,
  offsetTop: number
) {
  field.measureInWindow((_fx, fy, _fw, fh) => {
    field.measureLayout(
      content,
      (_x, y) => {
        let scrollY = Math.max(0, y - offsetTop);
        if (keyboardTop != null && keyboardTop > 0) {
          const fieldBottom = fy + fh;
          const limit = keyboardTop - KEYBOARD_GAP;
          if (fieldBottom > limit) {
            scrollY = Math.max(0, scrollY + (fieldBottom - limit));
          }
        }
        scroll.scrollTo({ y: scrollY, animated: true });
      },
      () => scrollScreenToEnd({ current: scroll })
    );
  });
}

/** Scroll so a field inside a `Screen scroll` stays above the keyboard. */
export function scrollToFieldInScreen(
  scrollRef: RefObject<ScrollView | null>,
  contentRef: RefObject<View | null>,
  fieldRef: RefObject<View | null>,
  offsetTop = FIELD_LABEL_VIEWPORT_TOP
) {
  ensureKeyboardTracking();
  const scroll = scrollRef.current;
  const content = contentRef.current;
  const field = fieldRef.current;
  if (!scroll || !content || !field) return;

  const apply = (keyboardTop: number | null) => {
    scrollFieldToVisible(scroll, content, field, keyboardTop ?? lastKeyboardScreenY, offsetTop);
  };

  if (lastKeyboardScreenY != null) {
    requestAnimationFrame(() => apply(lastKeyboardScreenY));
    return;
  }

  const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
  let done = false;
  const finish = (keyboardTop: number | null) => {
    if (done) return;
    done = true;
    sub.remove();
    clearTimeout(timer);
    requestAnimationFrame(() => apply(keyboardTop));
  };
  const sub = Keyboard.addListener(showEvent, (e) => finish(e.endCoordinates.screenY));
  const timer = setTimeout(() => finish(null), Platform.OS === 'android' ? 220 : 120);
}

/** Use as `onFocus` on inputs inside a scrolling `Screen`. */
export function fieldFocusScroll(
  scrollRef: RefObject<ScrollView | null>,
  contentRef: RefObject<View | null>,
  fieldRef: RefObject<View | null>
) {
  return () => scrollToFieldInScreen(scrollRef, contentRef, fieldRef);
}
