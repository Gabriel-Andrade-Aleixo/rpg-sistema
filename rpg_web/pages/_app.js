import '../styles/globals.css';
import Head from 'next/head';

export default function App({ Component, pageProps }) {
  return <>
    <Head>
      <title>Runalith RPG</title>
      <meta name="description" content="Runalith RPG: fichas inteligentes, catálogo oficial e rolagem 3D para sua mesa." />
      <meta name="theme-color" content="#655ca3" />
      <link rel="icon" type="image/png" href="/favicon.png" />
      <link rel="apple-touch-icon" href="/brand/runalith-icon-192.png" />
      <link rel="manifest" href="/manifest.webmanifest" />
    </Head>
    <Component {...pageProps} />
  </>;
}
