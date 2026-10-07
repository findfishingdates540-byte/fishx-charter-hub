import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import img1 from "@/assets/welcome-1.jpg";
import img2 from "@/assets/welcome-2.jpg";
import img3 from "@/assets/welcome-3.jpg";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome to Fish-X — Book fishing trips and gear" },
      { name: "description", content: "Sign up free to book fishing charters, guides and marinas, and shop tackle and apparel on Fish-X." },
      { property: "og:title", content: "Welcome to Fish-X" },
      { property: "og:description", content: "Charters, guides, marinas and gear in one fishing app." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WelcomePage,
});

const SLIDES = [img1, img2, img3];

function WelcomePage() {
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const t = setInterval(() => setI((n) => (n + 1) % SLIDES.length), 4500);
    return () => clearInterval(t);
  }, [navigate]);

  const oauth = async (provider: "google" | "apple" | "facebook") => {
    setErr("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) setErr(provider === "facebook" ? "Facebook sign-in isn't available yet. Use Google, Apple or email." : error.message);
  };

  return (
    <main className="fx-welcome">
      <div className="fx-welcome-hero">
        {SLIDES.map((src, n) => (
          <img key={n} src={src} alt="" width={768} height={1024} className={n === i ? "on" : ""} />
        ))}
        <span className="fx-welcome-badge">Fish-X</span>
        <div className="fx-welcome-dots">
          {SLIDES.map((_, n) => (
            <button key={n} aria-label={`Photo ${n + 1}`} className={n === i ? "on" : ""} onClick={() => setI(n)} />
          ))}
        </div>
      </div>
      <section className="fx-welcome-body">
        <h1>Fish. Connect. <em>Explore.</em></h1>
        <p>One app for anglers.<br />Charters • Guides • Marinas • Gear</p>
        <Link to="/auth" search={{ view: "signup" }} className="fx-welcome-primary">Sign Up Free</Link>
        <Link to="/auth" className="fx-welcome-secondary">Log In</Link>
        <div className="fx-welcome-or"><span>Or continue with</span></div>
        <div className="fx-welcome-social">
          <button aria-label="Continue with Google" onClick={() => oauth("google")}>G</button>
          <button aria-label="Continue with Apple" onClick={() => oauth("apple")}><svg width="20" height="22" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg></button>
          <button aria-label="Continue with Facebook" onClick={() => oauth("facebook")}>f</button>
        </div>
        {err && <p className="fx-welcome-err" role="alert">{err}</p>}
        <p className="fx-welcome-legal">
          By continuing, you agree to our <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </section>
    </main>
  );
}
