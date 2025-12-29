import React from "react";
import { Html, Head, Main, NextScript } from "expo-router/html";

export default function Root() {
  return (
    <Html>
      <Head>
        <meta name="theme-color" content="#0a0a12" />
        <style>{`
          html, body, #root {
            background-color: #0a0a12;
          }
        `}</style>
      </Head>
      <Main />
      <NextScript />
    </Html>
  );
}
