# react-native-image-viewer

Full-screen zoomable image viewer and gallery for React Native and Expo, built
on [Gesture Handler 3](https://docs.swmansion.com/react-native-gesture-handler/)
and [Reanimated 4](https://docs.swmansion.com/react-native-reanimated/).

It is a drop-in replacement for the commonly used props of the archived
`react-native-image-zoom-viewer`: same prop names and defaults, so switching
only changes the import.

- Pinch to zoom around the point between the fingers (up to `maxScale`).
- Double-tap to zoom in at the tapped point, or back out.
- Pan while zoomed, kept within the image edges, with a short glide.
- Swipe down to close (opt-in with `enableSwipeDown`), fading the backdrop.
- Several images become swipeable pages; paging pauses while zoomed.

## Installation

Install a tagged version straight from GitHub:

```sh
yarn add https://github.com/RaphaPetrereEtapa/react-native-image-viewer/archive/refs/tags/v1.0.0.tar.gz
```

The HTTPS tarball needs neither git nor an SSH key on the machine. The package
ships its TypeScript source, which Metro compiles, so there is no build step. It
uses your app's own copies of these peer dependencies:

| Peer dependency                | Version     |
| ------------------------------ | ----------- |
| `react-native-gesture-handler` | `>= 3.0.0`  |
| `react-native-reanimated`      | `>= 4.0.0`  |
| `react-native-worklets`        | `>= 0.10.0` |

Gesture Handler 3's hook API is required: apps on Gesture Handler 2 (Expo SDK
57 or older) need to upgrade first.

## Usage

The viewer fills its parent; render it inside a `Modal` for a full-screen
experience. It includes its own `GestureHandlerRootView`, which Android needs
inside a `Modal`.

```tsx
import ImageViewer from '@raphapetrereetapa/react-native-image-viewer';

<Modal transparent visible={visible} onRequestClose={close}>
  <ImageViewer
    imageUrls={[{ url: 'https://example.com/photo.jpg' }]}
    enableSwipeDown
    onCancel={close}
    renderFooter={() => <CloseButton onPress={close} />}
  />
</Modal>;
```

## Props

| Prop                     | Type                                    | Default      | Description                                                                |
| ------------------------ | --------------------------------------- | ------------ | -------------------------------------------------------------------------- |
| `imageUrls`              | `{ url: string }[]`                     | —            | Images to show; more than one makes a swipeable gallery.                   |
| `index`                  | `number`                                | `0`          | Image shown first.                                                         |
| `backgroundColor`        | `string`                                | `'black'`    | Backdrop color.                                                            |
| `style`                  | `ViewStyle`                             | —            | Style of the image area.                                                   |
| `enableSwipeDown`        | `boolean`                               | `false`      | Swipe down (when not zoomed) to close.                                     |
| `swipeDownThreshold`     | `number`                                | `120`        | Drag distance, in points, that closes the viewer (a fast flick also does). |
| `doubleClickInterval`    | `number`                                | `300`        | Maximum delay between the two taps of a double-tap, in ms.                 |
| `maxScale`               | `number`                                | `4`          | Maximum zoom.                                                              |
| `loadingRender`          | `() => ReactElement`                    | —            | Shown while an image loads.                                                |
| `renderHeader`           | `(currentIndex) => ReactElement`        | —            | Rendered above the images.                                                 |
| `renderFooter`           | `(currentIndex) => ReactElement`        | —            | Rendered at the bottom, over the images.                                   |
| `footerContainerStyle`   | `ViewStyle`                             | —            | Style of the footer's absolutely positioned container.                     |
| `renderIndicator`        | `(currentIndex, total) => ReactElement` | `"x/y"` text | Page indicator, shown only with more than one image (index is 1-based).    |
| `onChange`               | `(index) => void`                       | —            | Called when the gallery settles on another image.                          |
| `onClick`                | `(close, currentIndex) => void`         | —            | Single tap; `close` calls `onCancel`.                                      |
| `onCancel`               | `() => void`                            | —            | Called to close (swipe down, or `close` from `onClick`).                   |
| `onSwipeDown`            | `() => void`                            | —            | Called when closed by swiping down, before `onCancel`.                     |
| `saveToLocalByLongPress` | `boolean`                               | —            | Accepted for compatibility; there is no long-press menu.                   |

`IImageInfo` and `ImageViewerProps` are exported as types.

## Releasing a new version

1. Bump `version` in `package.json` and commit.
2. Tag the commit and push the tag:
   ```sh
   git tag v1.1.0
   git push origin main --tags
   ```
3. In each app, update the dependency to the new tag's tarball URL.

## Development

```sh
yarn install
yarn typecheck
yarn format-check
```

## License

MIT
