import React, { type ReactElement, useCallback, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { FlatList, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import ZoomableImage from './ZoomableImage';

export interface IImageInfo {
  url: string;
  width?: number;
  height?: number;
}

// The commonly used subset of react-native-image-zoom-viewer's props, with the
// same names and defaults, so replacing it only changes the import.
export interface ImageViewerProps {
  imageUrls: IImageInfo[];
  index?: number;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  footerContainerStyle?: StyleProp<ViewStyle>;
  enableSwipeDown?: boolean;
  swipeDownThreshold?: number;
  doubleClickInterval?: number;
  maxScale?: number;
  /** Accepted for compatibility; there is no long-press save menu. */
  saveToLocalByLongPress?: boolean;
  loadingRender?: () => ReactElement;
  renderHeader?: (currentIndex?: number) => ReactElement;
  renderFooter?: (currentIndex: number) => ReactElement;
  renderIndicator?: (currentIndex?: number, allSize?: number) => ReactElement;
  onChange?: (index?: number) => void;
  onClick?: (close?: () => void, currentShowIndex?: number) => void;
  onCancel?: () => void;
  onSwipeDown?: () => void;
}

const DOUBLE_TAP_SCALE = 2.5;

const defaultIndicator = (currentIndex?: number, allSize?: number) => (
  <View style={styles.count} pointerEvents='none'>
    <Text style={styles.countText}>
      {currentIndex}/{allSize}
    </Text>
  </View>
);

const ImageViewer = ({
  imageUrls,
  index = 0,
  backgroundColor = 'black',
  style,
  footerContainerStyle,
  enableSwipeDown = false,
  swipeDownThreshold = 120,
  doubleClickInterval = 300,
  maxScale = 4,
  loadingRender,
  renderHeader,
  renderFooter,
  renderIndicator = defaultIndicator,
  onChange,
  onClick,
  onCancel,
  onSwipeDown,
}: ImageViewerProps) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [current, setCurrent] = useState(index);
  const [zoomed, setZoomed] = useState(false);
  const dismissProgress = useSharedValue(0);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 1 - dismissProgress.value,
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) {
      setSize({ width, height });
    }
  };

  const cancel = useCallback(() => onCancel?.(), [onCancel]);

  const handleSwipeDown = useCallback(() => {
    onSwipeDown?.();
    onCancel?.();
  }, [onSwipeDown, onCancel]);

  const handleTap = useCallback(
    () => onClick?.(cancel, current),
    [onClick, cancel, current],
  );

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (size.width === 0) return;
    const page = Math.round(e.nativeEvent.contentOffset.x / size.width);
    if (page !== current) {
      setCurrent(page);
      onChange?.(page);
    }
  };

  const renderPage = (item: IImageInfo) => (
    <ZoomableImage
      uri={item.url}
      width={size.width}
      height={size.height}
      maxScale={maxScale}
      doubleTapScale={DOUBLE_TAP_SCALE}
      doubleTapInterval={doubleClickInterval}
      enableSwipeDown={enableSwipeDown}
      swipeDownThreshold={swipeDownThreshold}
      dismissProgress={dismissProgress}
      loadingRender={loadingRender}
      onSingleTap={handleTap}
      onSwipeDown={handleSwipeDown}
      onZoomChange={setZoomed}
    />
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor }, backdropStyle]}
      />
      {renderHeader?.(current)}
      <View style={[styles.pages, style]} onLayout={onLayout}>
        {size.width === 0 ? null : imageUrls.length === 1 ? (
          renderPage(imageUrls[0])
        ) : (
          <FlatList
            data={imageUrls}
            keyExtractor={(item, i) => `${i}-${item.url}`}
            horizontal
            pagingEnabled
            scrollEnabled={!zoomed}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={index}
            getItemLayout={(_, i) => ({
              length: size.width,
              offset: size.width * i,
              index: i,
            })}
            onMomentumScrollEnd={onMomentumScrollEnd}
            renderItem={({ item }) => renderPage(item)}
          />
        )}
      </View>
      {imageUrls.length > 1
        ? renderIndicator(current + 1, imageUrls.length)
        : null}
      {renderFooter ? (
        <View style={[styles.footer, footerContainerStyle]}>
          {renderFooter(current)}
        </View>
      ) : null}
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  pages: { flex: 1, overflow: 'hidden' },
  footer: { position: 'absolute', bottom: 0, zIndex: 9 },
  count: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 38,
    zIndex: 13,
    alignItems: 'center',
  },
  countText: {
    color: 'white',
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default ImageViewer;
