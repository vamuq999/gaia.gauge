export const metadata = {
  title: "GaiaGauge",
  description: "Measure energy. Reduce waste. Prove progress.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}