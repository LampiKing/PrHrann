import React from "react";
import { ScrollViewStyleReset } from "expo-router/html";

type Props = {
  children: React.ReactNode;
};

export default function Root({ children }: Props) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <meta name="theme-color" content="#0a0a12" />
        <ScrollViewStyleReset />
        <style>{`
          html, body, #root {
            background-color: #0a0a12;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
