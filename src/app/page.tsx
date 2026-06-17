import BackgroundVideo from "./components/BackgroundVideo";
import HeroSection from "./components/HeroSection";

export default function Home() {
  return (
    <main className="relative flex-1">
      <BackgroundVideo />
      <HeroSection />
    </main>
  );
}
