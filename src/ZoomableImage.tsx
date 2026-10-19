import React, { type ReactElement, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  useExclusiveGestures,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const MIN_SCALE = 1;
// How far a pan may go past the image edge while the finger is down.
const OVERDRAG = 0.3;
const SETTLE = { duration: 200 };

interface ZoomableImageProps {
  uri: string;
  width: number;
  height: number;
  maxScale: number;
  doubleTapScale: number;
  doubleTapInterval: number;
  enableSwipeDown: boolean;
  swipeDownThreshold: number;
  // 0 at rest, 1 when dragged half the screen down; drives the backdrop fade.
  dismissProgress: SharedValue<number>;
  loadingRender?: () => ReactElement;
  onSingleTap: () => void;
  onSwipeDown: () => void;
  onZoomChange: (zoomed: boolean) => void;
}

// One full-page image that can be pinched, double-tapped, panned while zoomed
// and swiped down to close. Translation is in screen points around the page
// center, applied before the scale.
const ZoomableImage = ({
  uri,
  width,
  height,
  maxScale,
  doubleTapScale,
  doubleTapInterval,
  enableSwipeDown,
  swipeDownThreshold,
  dismissProgress,
  loadingRender,
  onSingleTap,
  onSwipeDown,
  onZoomChange,
}: ZoomableImageProps) => {
  const [loaded, setLoaded] = useState(false);

  const imageW = useSharedValue(0);
  const imageH = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const dismissY = useSharedValue(0);
  const zoomed = useSharedValue(false);
  const canDismiss = useSharedValue(enableSwipeDown);

  const maxOffset = (s: number) => {
    'worklet';
    return {
      x: Math.max(0, (imageW.value * s - width) / 2),
      y: Math.max(0, (imageH.value * s - height) / 2),
    };
  };

  const clamp = (value: number, limit: number) => {
    'worklet';
    return Math.min(Math.max(value, -limit), limit);
  };

  // Lets the finger drag past the edge, with growing resistance.
  const overdrag = (value: number, limit: number) => {
    'worklet';
    if (value > limit) return limit + (value - limit) * OVERDRAG;
    if (value < -limit) return -limit + (value + limit) * OVERDRAG;
    return value;
  };

  const setZoomed = (isZoomed: boolean) => {
    'worklet';
    if (zoomed.value === isZoomed) return;
    zoomed.value = isZoomed;
    canDismiss.value = enableSwipeDown && !isZoomed;
    scheduleOnRN(onZoomChange, isZoomed);
  };

  // Animates to a valid state: back to 1x when zoomed out too far, and the
  // image edges inside the page.
  const settle = (targetScale: number) => {
    'worklet';
    const s = Math.min(Math.max(targetScale, MIN_SCALE), maxScale);
    const limit = maxOffset(s);
    scale.value = withTiming(s, SETTLE);
    tx.value = withTiming(
      s === MIN_SCALE ? 0 : clamp(tx.value, limit.x),
      SETTLE,
    );
    ty.value = withTiming(
      s === MIN_SCALE ? 0 : clamp(ty.value, limit.y),
      SETTLE,
    );
    setZoomed(s > MIN_SCALE);
  };

  // Zooms to `s` keeping the point (fx, fy) — relative to the page center —
  // under the fingers.
  const zoomAround = (s: number, fx: number, fy: number) => {
    'worklet';
    const ratio = s / savedScale.value;
    tx.value = fx - (fx - savedTx.value) * ratio;
    ty.value = fy - (fy - savedTy.value) * ratio;
    scale.value = s;
  };

  const pinch = usePinchGesture({
    onActivate: (e) => {
      savedScale.value = scale.value;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
      focalX.value = e.focalX - width / 2;
      focalY.value = e.focalY - height / 2;
    },
    onUpdate: (e) => {
      const s = Math.min(
        Math.max(savedScale.value * e.scale, MIN_SCALE / 2),
        maxScale * 1.5,
      );
      zoomAround(s, focalX.value, focalY.value);
    },
    onDeactivate: () => {
      settle(scale.value);
    },
  });

  const pan = usePanGesture({
    enabled: zoomed,
    maxPointers: 1,
    onActivate: () => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    },
    onUpdate: (e) => {
      const limit = maxOffset(scale.value);
      tx.value = overdrag(savedTx.value + e.translationX, limit.x);
      ty.value = overdrag(savedTy.value + e.translationY, limit.y);
    },
    onDeactivate: (e) => {
      const limit = maxOffset(scale.value);
      tx.value =
        Math.abs(tx.value) > limit.x
          ? withTiming(clamp(tx.value, limit.x), SETTLE)
          : withDecay({ velocity: e.velocityX, clamp: [-limit.x, limit.x] });
      ty.value =
        Math.abs(ty.value) > limit.y
          ? withTiming(clamp(ty.value, limit.y), SETTLE)
          : withDecay({ velocity: e.velocityY, clamp: [-limit.y, limit.y] });
    },
  });

  const dismiss = usePanGesture({
    enabled: canDismiss,
    maxPointers: 1,
    // Only a mostly vertical drag downwards; a horizontal one is left to the
    // gallery to change pages.
    activeOffsetY: 10,
    failOffsetX: [-15, 15],
    onUpdate: (e) => {
      dismissY.value = Math.max(0, e.translationY);
      dismissProgress.value = Math.min(1, dismissY.value / (height / 2));
    },
    onDeactivate: (e) => {
      if (dismissY.value > swipeDownThreshold || e.velocityY > 1000) {
        scheduleOnRN(onSwipeDown);
        return;
      }
      dismissY.value = withTiming(0, SETTLE);
      dismissProgress.value = withTiming(0, SETTLE);
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    maxDelay: doubleTapInterval,
    onDeactivate: (e) => {
      if (e.canceled) return;
      if (zoomed.value) {
        settle(MIN_SCALE);
        return;
      }
      savedScale.value = 1;
      savedTx.value = 0;
      savedTy.value = 0;
      const limit = maxOffset(doubleTapScale);
      const fx = e.x - width / 2;
      const fy = e.y - height / 2;
      scale.value = withTiming(doubleTapScale, SETTLE);
      tx.value = withTiming(clamp(fx * (1 - doubleTapScale), limit.x), SETTLE);
      ty.value = withTiming(clamp(fy * (1 - doubleTapScale), limit.y), SETTLE);
      setZoomed(true);
    },
  });

  const singleTap = useTapGesture({
    onDeactivate: (e) => {
      if (!e.canceled) scheduleOnRN(onSingleTap);
    },
  });

  const taps = useExclusiveGestures(doubleTap, singleTap);
  const gesture = useSimultaneousGestures(pinch, pan, dismiss, taps);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value + dismissY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.page, { width, height }]}>
        <Animated.View style={imageStyle}>
          {/* Full page size from the start: iOS decodes the bitmap for the
              view's size, so a placeholder size would leave it blurry. */}
          <Image
            source={{ uri }}
            style={{ width, height, opacity: loaded ? 1 : 0 }}
            resizeMode='contain'
            onLoad={(e) => {
              // The contained image's size, for the pan and zoom limits.
              const { width: iw, height: ih } = e.nativeEvent.source;
              const fit = Math.min(width / iw, height / ih);
              imageW.value = iw * fit;
              imageH.value = ih * fit;
              setLoaded(true);
            }}
          />
        </Animated.View>
        {!loaded && loadingRender ? (
          <View
            style={[StyleSheet.absoluteFill, styles.center]}
            pointerEvents='none'
          >
            {loadingRender()}
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  page: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  center: { alignItems: 'center', justifyContent: 'center' },
});

export default ZoomableImage;
