"use client";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Suspense } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const features = [
    {
      icon: "🎥",
      title: "Démarrer une session",
      desc: "Lancez une classe virtuelle en direct avec vidéo, audio, partage d'écran et outils pédagogiques intégrés.",
      color: "#1a56db", bg: "#e8f0fe", border: "#b8d0fb",
    },
    {
      icon: "📹",
      title: "Enregistrer vos sessions",
      desc: "Enregistrez automatiquement vos webinaires et rendez-les disponibles pour les étudiants après la session.",
      color: "#0f6e56", bg: "#e1f5ee", border: "#9fe1cb",
    },
    {
      icon: "🏠",
      title: "Gérer vos salles",
      desc: "Créez et configurez vos salles de cours, définissez les accès et paramétrez chaque session selon vos besoins.",
      color: "#854f0b", bg: "#faeeda", border: "#fac775",
    },
    {
      icon: "👥",
      title: "Gérer les participants",
      desc: "Enrôlez vos étudiants individuellement ou en masse via CSV, attribuez des rôles et suivez les participations.",
      color: "#0c447c", bg: "#e6f1fb", border: "#85b7eb",
    },
  ];

  return (
    <main style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      background: "#f5f8ff",
      fontFamily: "'Google Sans','Segoe UI',system-ui,sans-serif",
    }}>
      <style>{`
        .features-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          max-width: 1100px;
          margin: 0 auto;
        }
        .header-title { font-size: 0.95rem; font-weight: 700; color: #2d4a6e; }
        @media (max-width: 900px) {
          .features-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 540px) {
          .features-grid { grid-template-columns: 1fr !important; }
          .header-title { display: none; }
          .header-divider { display: none; }
        }
      `}</style>

      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 32px", background: "white", borderBottom: "1px solid #e8eaed",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Image src="/logo-unchk.png" alt="UN-CHK" width={120} height={48}
            style={{ objectFit: "contain" }} priority />
          <div className="header-divider" style={{ width: 1.5, height: 40, background: "#e8eaed" }} />
          <span className="header-title">Plateforme Webinaire UN-CHK</span>
        </div>
        <button
          onClick={() => signIn("keycloak", { callbackUrl })}
          style={{
            padding: "10px 24px", background: "#0065b1", color: "white",
            border: "none", borderRadius: 8, fontSize: "0.9rem", fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
          }}
        >
          S&apos;identifier
        </button>
      </header>

      <section style={{
        textAlign: "center", padding: "56px 24px 40px",
        maxWidth: 700, margin: "0 auto", width: "100%",
      }}>
        <h1 style={{
          fontSize: "clamp(1.4rem, 4vw, 2rem)", fontWeight: 700,
          color: "#1a1a2e", marginBottom: 16, lineHeight: 1.3,
        }}>
          Bienvenue sur la Plateforme Webinaire UN-CHK
        </h1>
        <p style={{
          fontSize: "clamp(0.88rem, 2vw, 1rem)", color: "#5f6368", lineHeight: 1.7,
        }}>
          La plateforme de webconférence de l&apos;Université Numérique Cheikh Hamidou Kane,
          conçue pour faciliter l&apos;enseignement à distance, la collaboration et le suivi
          pédagogique en temps réel.
        </p>
      </section>

      <section style={{ padding: "0 24px 64px", width: "100%" }}>
        <p style={{
          textAlign: "center", fontSize: "0.75rem", fontWeight: 700,
          color: "#9aa0a6", letterSpacing: 1, textTransform: "uppercase", marginBottom: 24,
        }}>
          Découvrez les fonctionnalités
        </p>
        <div className="features-grid">
          {features.map(f => (
            <div key={f.title} style={{
              background: "white", borderRadius: 14,
              border: `1.5px solid ${f.border}`, padding: "24px 20px",
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 12, background: f.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.5rem", marginBottom: 14,
              }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: f.color, marginBottom: 8 }}>
                {f.title}
              </h3>
              <p style={{ fontSize: "0.84rem", color: "#5f6368", lineHeight: 1.6, margin: 0 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer style={{
        background: "white", borderTop: "2px solid rgba(0,101,177,0.12)",
        padding: "20px 32px", textAlign: "center", marginTop: "auto",
      }}>
        <p style={{ fontSize: "0.78rem", color: "#5f6368", margin: 0 }}>
          Ministère de l&apos;Enseignement Supérieur, de la Recherche et de l&apos;Innovation
        </p>
        <p style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0065b1", marginTop: 2 }}>
          Université Numérique Cheikh Hamidou Kane (UN-CHK)
        </p>
        <p style={{ fontSize: "0.72rem", color: "#9aa0a6", marginTop: 2 }}>
          © DITSI – UN-CHK – 2026 – Tous droits réservés
        </p>
      </footer>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense><LoginContent /></Suspense>;
}
