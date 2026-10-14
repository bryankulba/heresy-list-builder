/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

declare module '*.svg?raw' {
  const content: string;
  export default content;
}
