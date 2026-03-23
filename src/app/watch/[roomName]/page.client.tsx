"use client";

import React, { useState, useEffect } from "react";
import { LiveKitRoom, useLocalParticipant, useParticipants, useRoomContext, VideoTrack, AudioTrack, useTracks, StartAudio, useChat } from "@livekit/components-react";
import { Track, Participant } from "livekit-client";
import { TokenContext } from "@/components/token-context";
import { Chat } from "@/components/chat";
import { JoinStreamResponse, ParticipantMetadata, RoomMetadata } from "@/lib/controller";
import { useAuthToken } from "@/components/token-context";

function JoinForm({ roomName, onJoin }: {
  roomName: string;
  onJoin: (authToken: string, roomToken: string) => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/join_stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_name: roomName, identity: name.trim() }),
      });
      if (!res.ok) { setError(await res.text()); return; }
      const { auth_token, connection_details: { token } } = await res.json() as JoinStreamResponse;
      onJoin(auth_token, token);
    } catch { setError("Erreur réseau"); }
    finally { setLoading(false); }
  };

  return (
    <div className="jf-root">
      <div className="jf-card">
        <div className="jf-logo">
          <img src="/logo-unchk.png" alt="UN-CHK" style={{height:"36px",objectFit:"contain"}} onError={e => (e.currentTarget.style.display="none")} />
        </div>
        <div className="jf-icon">📺</div>
        <h2 className="jf-title">Rejoindre le stream</h2>
        <p className="jf-room">{decodeURIComponent(roomName)}</p>
        <input className="jf-input" type="text" placeholder="Votre nom" value={name}
          onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleJoin()} autoFocus />
        {error && <p className="jf-error">{error}</p>}
        <button className="jf-btn" onClick={handleJoin} disabled={loading || !name.trim()}>
          {loading ? <span className="jf-spinner" /> : "Rejoindre en tant que spectateur"}
        </button>
        <a href="/" className="jf-back">← Retour</a>
      </div>
      <style>{`
        .jf-root{min-height:100dvh;background:#0d1117;display:flex;align-items:center;justify-content:center;font-family:'Segoe UI',system-ui,sans-serif;}
        .jf-card{background:#161b22;border:1px solid #21262d;border-radius:12px;padding:40px;width:100%;max-width:400px;display:flex;flex-direction:column;align-items:center;gap:16px;box-shadow:0 8px 40px rgba(0,0,0,.5);}
        .jf-logo{margin-bottom:4px;}
        .jf-icon{font-size:2rem;}
        .jf-title{font-size:1.2rem;font-weight:700;color:#e6edf3;}
        .jf-room{font-size:0.82rem;color:#58a6ff;background:rgba(88,166,255,.1);padding:4px 12px;border-radius:20px;border:1px solid rgba(88,166,255,.2);}
        .jf-input{width:100%;padding:10px 14px;background:#0d1117;border:1px solid #30363d;border-radius:8px;color:#e6edf3;font-size:0.9rem;outline:none;font-family:inherit;transition:border-color .2s;}
        .jf-input:focus{border-color:#58a6ff;}
        .jf-input::placeholder{color:#484f58;}
        .jf-error{color:#f85149;font-size:0.82rem;}
        .jf-btn{width:100%;padding:11px;background:#238636;color:white;border:none;border-radius:8px;font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;min-height:42px;display:flex;align-items:center;justify-content:center;transition:background .2s;}
        .jf-btn:hover:not(:disabled){background:#2ea043;}
        .jf-btn:disabled{opacity:.5;cursor:not-allowed;}
        .jf-back{font-size:0.8rem;color:#8b949e;text-decoration:none;}
        .jf-back:hover{color:#e6edf3;}
        .jf-spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:white;border-radius:50%;animation:spin .7s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}

export default function WatchPage({ roomName, serverUrl }: { roomName: string; serverUrl: string }) {
  const [session, setSession] = useState<{ authToken: string; roomToken: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get("token")
    if (token && !session) {
      setSession({ authToken: token, roomToken: token })
    }
  }, [])

  if (!session) {
    return <JoinForm roomName={roomName} onJoin={(authToken, roomToken) => setSession({ authToken, roomToken })} />;
  }

  return (
    <TokenContext.Provider value={session.authToken}>
      <LiveKitRoom serverUrl={serverUrl} token={session.roomToken} connect={true} style={{ height: "100dvh" }}>
        <ViewerRoom />
      </LiveKitRoom>
    </TokenContext.Provider>
  );
}

function ViewerRoom() {
  const authToken = useAuthToken();
  const room = useRoomContext();
  const { send: sendChat, chatMessages } = useChat();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare, Track.Source.Microphone]);

  const [panel, setPanel] = useState<"chat" | null>("chat");
  const [raisingHand, setRaisingHand] = useState(false);
  const [shareOn, setShareOn] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{id:number;emoji:string;x:number}[]>([]);
  const [returnUrl, setReturnUrl] = useState("/");

  const getMeta = (p: Participant): ParticipantMetadata => {
    try { return JSON.parse(p.metadata || "{}"); } catch { return { hand_raised: false, invited_to_stage: false, avatar_image: "" }; }
  };

  const me = participants.find(p => p.identity === localParticipant.identity);
  const myMeta = me ? getMeta(me) : { hand_raised: false, invited_to_stage: false, avatar_image: "" };
  const onStage = myMeta.invited_to_stage;
  const handRaised = myMeta.hand_raised;
  const micOn = localParticipant.isMicrophoneEnabled;
  const camOn = localParticipant.isCameraEnabled;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("returnUrl");
    if (r) setReturnUrl(r);
  }, []);

  useEffect(() => {
    if (!onStage) {
      localParticipant.setCameraEnabled(false);
      localParticipant.setMicrophoneEnabled(false);
      localParticipant.setScreenShareEnabled(false);
      setShareOn(false);
    }
  }, [onStage]);

  const launchEmoji = (emoji: string) => {
    sendChat?.(`__emoji__${emoji}`);
    setShowEmojiPicker(false);
  };

  const lastMsgTs = chatMessages[chatMessages.length - 1]?.timestamp;
  React.useEffect(() => {
    const last = chatMessages[chatMessages.length - 1];
    if (last?.message?.startsWith("__emoji__")) {
      const emoji = last.message.replace("__emoji__", "");
      const id = Date.now() + Math.random();
      const x = 20 + Math.random() * 60;
      setFloatingEmojis(prev => [...prev, { id, emoji, x }]);
      setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== id)), 3000);
    }
  }, [lastMsgTs]);

  const raiseHand = async () => {
    if (raisingHand || handRaised) return;
    setRaisingHand(true);
    try {
      await fetch("/api/raise_hand", { method: "POST", headers: { Authorization: `Bearer ${authToken}` } });
    } finally { setRaisingHand(false); }
  };

  const leaveStage = async () => {
    await fetch("/api/remove_from_stage", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({}),
    });
  };

  const audioOptions = { noiseSuppression: true, echoCancellation: true, autoGainControl: true };

  const screenTrack = tracks.find(t => t.source === Track.Source.ScreenShare && t.participant.identity !== localParticipant.identity);
  const camTracks = tracks.filter(t => t.source === Track.Source.Camera);
  const audioTracks = tracks.filter(t => t.source === Track.Source.Microphone && t.participant.identity !== localParticipant.identity);

  const roomMeta = (() => { try { return JSON.parse(room.metadata || "{}") as RoomMetadata; } catch { return null; } })();
  const hostId = roomMeta?.creator_identity;
  const mainCamTrack = camTracks.find(t => t.participant.identity === hostId) || camTracks.find(t => t.participant.identity !== localParticipant.identity);
  const stageParts = participants.filter(p => p.identity !== localParticipant.identity && getMeta(p).invited_to_stage);
  const stageCamTracks = camTracks.filter(t => stageParts.some(p => p.identity === t.participant.identity) && t.participant.identity !== hostId);

  return (
    <div className="v-root">
      <div className="v-topbar">
        <div className="v-topbar-left">
          <img src="/logo-unchk.png" alt="UN-CHK" className="v-topbar-logo" onError={e => (e.currentTarget.style.display="none")} />
          <span className="v-room-id">{room.name}</span>
          <div className="v-live-pill"><span className="v-live-dot"/>EN DIRECT</div>
        </div>
        <div className="v-topbar-right">
          <div className="v-conn-badge"><span className="v-conn-dot"/>Connecté</div>
          <div className="v-count-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            {participants.length}
          </div>
          <div className="v-identity-badge">
            <span className="v-identity-avatar">{localParticipant.identity.charAt(0).toUpperCase()}</span>
            <span className="v-identity-name">{localParticipant.identity}</span>
            <span className="v-identity-role">Spectateur</span>
          </div>
        </div>
      </div>

      <div className="v-body">
        <div className="v-stage">
          <div className="v-main-video">
            {screenTrack ? (
              <VideoTrack trackRef={screenTrack} className="v-video-el" />
            ) : mainCamTrack ? (
              <VideoTrack trackRef={mainCamTrack} className="v-video-el" />
            ) : (
              <div className="v-no-video">
                <div className="v-no-video-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/></svg>
                </div>
                <p className="v-no-video-title">En attente du stream...</p>
                <p className="v-no-video-sub">L&apos;animateur n&apos;a pas encore démarré</p>
              </div>
            )}
            {mainCamTrack && !screenTrack && (
              <div className="v-name-tag">{mainCamTrack.participant.identity}</div>
            )}
            {screenTrack && (
              <div className="v-pip-container">
                {mainCamTrack && (
                  <div className="v-pip-tile">
                    <VideoTrack trackRef={mainCamTrack} className="v-video-el" />
                    <div className="v-pip-name">{mainCamTrack.participant.identity}</div>
                  </div>
                )}
                {stageCamTracks.map(t => (
                  <div key={t.participant.identity} className="v-pip-tile">
                    <VideoTrack trackRef={t} className="v-video-el" />
                    <div className="v-pip-name">{t.participant.identity}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!screenTrack && stageCamTracks.length > 0 && (
            <div className="v-strip">
              {stageCamTracks.map(t => (
                <div key={t.participant.identity} className="v-tile">
                  <VideoTrack trackRef={t} className="v-video-el" />
                  <div className="v-tile-name">{t.participant.identity}</div>
                </div>
              ))}
            </div>
          )}

          {audioTracks.map(t => <AudioTrack key={t.participant.identity} trackRef={t} />)}

          {onStage && (
            <div className="v-on-stage">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
              Vous êtes sur scène
              <button className="v-leave-stage" onClick={leaveStage}>Quitter la scène</button>
            </div>
          )}

          <StartAudio label="Cliquez pour activer le son" className="v-start-audio" />

          {floatingEmojis.map(fe => (
            <div key={fe.id} className="v-floating-emoji" style={{left:`${fe.x}%`}}>{fe.emoji}</div>
          ))}

          {showEmojiPicker && (
            <div className="v-emoji-picker">
              {["👍","👏","❤️","😂","😮","🎉","🙌","🔥","💯","👋"].map(e => (
                <button key={e} className="v-emoji-btn" onClick={() => launchEmoji(e)}>{e}</button>
              ))}
            </div>
          )}
        </div>

        <div className="v-panel" style={{ display: panel === "chat" ? "flex" : "none" }}>
          <div className="v-panel-hdr">
            <div className="v-panel-hdr-left">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>Chat</span>
            </div>
            <button className="v-panel-close" onClick={() => setPanel(null)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <Chat />
        </div>
      </div>

      <div className="v-controls">
        <div className="v-controls-inner">
          <div className="v-ctrl-left">
            <div className="v-room-info">
              <img src="/logo-unchk.png" alt="" className="v-ctrl-logo" onError={e => (e.currentTarget.style.display="none")} />
              <span className="v-ctrl-room">{room.name}</span>
              <span className="v-ctrl-sep">·</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span className="v-ctrl-count">{participants.length}</span>
            </div>
          </div>

          <div className="v-ctrl-center">
            {onStage && (
              <button className={`v-btn${!micOn ? " off" : ""}`} onClick={() => localParticipant.setMicrophoneEnabled(!micOn, audioOptions)}>
                <div className="v-btn-icon">
                  {micOn ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                  )}
                </div>
                <span className="v-btn-label">Micro</span>
              </button>
            )}

            {onStage && (
              <button className={`v-btn${!camOn ? " off" : ""}`} onClick={() => localParticipant.setCameraEnabled(!camOn)}>
                <div className="v-btn-icon">
                  {camOn ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h2a2 2 0 0 1 2 2v9.34m-7.72-2.06a4 4 0 1 1-5.56-5.56"/></svg>
                  )}
                </div>
                <span className="v-btn-label">Caméra</span>
              </button>
            )}

            {onStage && (
              <button className={`v-btn${shareOn ? " active" : ""}`} onClick={async () => { await localParticipant.setScreenShareEnabled(!shareOn); setShareOn(!shareOn); }}>
                <div className="v-btn-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                </div>
                <span className="v-btn-label">Écran</span>
              </button>
            )}

            <button className={`v-btn${showEmojiPicker ? " active" : ""}`} onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
              <div className="v-btn-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
              </div>
              <span className="v-btn-label">Réagir</span>
            </button>

            {!onStage && (
              <button className={`v-btn${handRaised ? " raised" : ""}`} onClick={raiseHand} disabled={handRaised || raisingHand}>
                <div className="v-btn-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
                </div>
                <span className="v-btn-label">{handRaised ? "Main levée" : "Main"}</span>
              </button>
            )}

            {onStage && (
              <button className="v-btn stage-active" onClick={leaveStage}>
                <div className="v-btn-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
                </div>
                <span className="v-btn-label">Sur scène</span>
              </button>
            )}

            <button className={`v-btn${panel === "chat" ? " active" : ""}`} onClick={() => setPanel(panel === "chat" ? null : "chat")}>
              <div className="v-btn-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <span className="v-btn-label">Chat</span>
            </button>

            <a href={returnUrl} className="v-btn quit">
              <div className="v-btn-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.25 1.01l-2.2 2.2z" transform="rotate(135 12 12)"/></svg>
            </div>
              <span className="v-btn-label">Quitter</span>
            </a>
          </div>

          <div className="v-ctrl-right" />
        </div>
      </div>

      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        .v-root{display:flex;flex-direction:column;height:100dvh;background:#0d1117;color:#e6edf3;font-family:'Segoe UI',system-ui,sans-serif;}
        .v-topbar{display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:#161b22;border-bottom:1px solid #21262d;flex-shrink:0;height:52px;}
        .v-topbar-left{display:flex;align-items:center;gap:12px;}
        .v-topbar-right{display:flex;align-items:center;gap:10px;}
        .v-topbar-logo{height:28px;object-fit:contain;}
        .v-room-id{font-size:0.85rem;font-weight:500;color:#e6edf3;background:#21262d;border:1px solid #30363d;padding:3px 10px;border-radius:6px;}
        .v-live-pill{display:flex;align-items:center;gap:5px;background:rgba(248,81,73,.12);border:1px solid rgba(248,81,73,.3);border-radius:20px;padding:3px 10px;font-size:0.7rem;font-weight:700;color:#f85149;letter-spacing:.05em;}
        .v-live-dot{width:6px;height:6px;border-radius:50%;background:#f85149;animation:pulse 1.5s ease-in-out infinite;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        .v-conn-badge{display:flex;align-items:center;gap:5px;font-size:0.78rem;color:#3fb950;}
        .v-conn-dot{width:7px;height:7px;border-radius:50%;background:#3fb950;}
        .v-count-badge{display:flex;align-items:center;gap:5px;font-size:0.82rem;color:#8b949e;background:#21262d;padding:4px 10px;border-radius:8px;border:1px solid #30363d;}
        .v-identity-badge{display:flex;align-items:center;gap:8px;background:#21262d;border:1px solid #30363d;border-radius:8px;padding:4px 12px;}
        .v-identity-avatar{width:24px;height:24px;border-radius:50%;background:#388bfd;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:white;flex-shrink:0;}
        .v-identity-name{font-size:0.82rem;font-weight:500;color:#e6edf3;}
        .v-identity-role{font-size:0.7rem;color:#8b949e;background:#161b22;padding:1px 6px;border-radius:4px;}
        .v-body{display:flex;flex:1;overflow:hidden;}
        .v-stage{flex:1;display:flex;flex-direction:column;overflow:hidden;position:relative;background:#010409;}
        .v-main-video{flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;}
        .v-video-el{width:100%;height:100%;object-fit:contain;}
        .v-no-video{display:flex;flex-direction:column;align-items:center;gap:12px;color:#484f58;text-align:center;}
        .v-no-video-icon{width:80px;height:80px;border-radius:50%;background:#161b22;border:1px solid #21262d;display:flex;align-items:center;justify-content:center;color:#30363d;}
        .v-no-video-title{font-size:1rem;font-weight:600;color:#8b949e;}
        .v-no-video-sub{font-size:0.82rem;color:#484f58;}
        .v-name-tag{position:absolute;bottom:12px;left:12px;background:rgba(1,4,9,.7);backdrop-filter:blur(4px);color:#e6edf3;font-size:0.78rem;padding:4px 10px;border-radius:4px;border:1px solid #21262d;}
        .v-strip{display:flex;gap:8px;padding:8px;background:#0d1117;overflow-x:auto;flex-shrink:0;}
        .v-pip-container{position:absolute;bottom:16px;right:16px;display:flex;flex-direction:column;gap:8px;z-index:10;}
        .v-pip-tile{width:176px;height:110px;border-radius:8px;overflow:hidden;background:#161b22;position:relative;border:2px solid #388bfd;box-shadow:0 4px 20px rgba(0,0,0,.6);}
        .v-pip-name{position:absolute;bottom:4px;left:6px;font-size:0.68rem;color:white;background:rgba(1,4,9,.75);padding:2px 6px;border-radius:3px;}
        .v-tile{width:160px;height:100px;border-radius:8px;background:#161b22;position:relative;flex-shrink:0;overflow:hidden;}
        .v-tile-name{position:absolute;bottom:4px;left:6px;font-size:0.72rem;color:white;background:rgba(0,0,0,.5);padding:2px 6px;border-radius:3px;}
        .v-on-stage{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);background:rgba(63,185,80,.15);border:1px solid #3fb950;color:#3fb950;padding:8px 18px;border-radius:24px;font-size:0.82rem;font-weight:600;display:flex;align-items:center;gap:10px;backdrop-filter:blur(4px);}
        .v-leave-stage{background:rgba(248,81,73,.15);border:1px solid rgba(248,81,73,.4);color:#f85149;padding:3px 10px;border-radius:6px;font-size:0.75rem;cursor:pointer;font-family:inherit;transition:background .2s;}
        .v-leave-stage:hover{background:rgba(248,81,73,.25);}
        .v-start-audio{position:absolute;inset:0;background:rgba(1,4,9,.8);color:#e6edf3;border:none;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);}
        .v-panel{width:300px;flex-shrink:0;background:#161b22;border-left:1px solid #21262d;flex-direction:column;}
        .v-panel-hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #21262d;font-weight:600;font-size:0.88rem;color:#e6edf3;flex-shrink:0;}
        .v-panel-hdr-left{display:flex;align-items:center;gap:8px;color:#8b949e;}
        .v-panel-hdr-left span{color:#e6edf3;}
        .v-panel-close{width:28px;height:28px;background:none;border:none;color:#8b949e;cursor:pointer;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:background .15s;}
        .v-panel-close:hover{background:#21262d;color:#e6edf3;}
        .v-controls{background:#161b22;border-top:1px solid #21262d;flex-shrink:0;padding:10px 24px;}
        .v-controls-inner{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;max-width:100%;}
        .v-ctrl-left{display:flex;align-items:center;}
        .v-room-info{display:flex;align-items:center;gap:6px;font-size:0.78rem;color:#8b949e;}
        .v-ctrl-logo{height:20px;object-fit:contain;}
        .v-ctrl-room{color:#e6edf3;font-weight:500;}
        .v-ctrl-sep{color:#484f58;}
        .v-ctrl-count{color:#8b949e;}
        .v-ctrl-center{display:flex;align-items:flex-start;gap:4px;justify-content:center;}
        .v-btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 10px;background:none;border:none;color:#8b949e;cursor:pointer;font-family:inherit;border-radius:8px;transition:background .15s,color .15s;text-decoration:none;min-width:52px;}
        .v-btn:hover{background:#21262d;color:#e6edf3;}
        .v-btn.active .v-btn-icon{background:#1f6feb;color:white;}
        .v-btn.active{color:#58a6ff;}
        .v-btn.off .v-btn-icon{background:#3d1a1a;color:#f85149;}
        .v-btn.off{color:#f85149;}
        .v-btn.raised .v-btn-icon{background:#3a2f00;color:#e3b341;}
        .v-btn.raised{color:#e3b341;}
        .v-btn.stage-active .v-btn-icon{background:#0d3321;color:#3fb950;}
        .v-btn.stage-active{color:#3fb950;}
        .v-btn.quit .v-btn-icon{background:#3d1a1a;color:#f85149;}
        .v-btn.quit{color:#f85149;}
        .v-btn.quit:hover .v-btn-icon{background:#5a1d1d;}
        .v-btn-icon{width:44px;height:44px;border-radius:50%;background:#21262d;display:flex;align-items:center;justify-content:center;transition:background .15s;}
        .v-btn:hover .v-btn-icon{background:#30363d;}
        .v-btn-label{font-size:0.68rem;font-weight:500;white-space:nowrap;}
        .v-emoji-picker{position:absolute;bottom:100px;left:50%;transform:translateX(-50%);background:#161b22;border:1px solid #21262d;border-radius:12px;padding:12px 16px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:300px;box-shadow:0 8px 32px rgba(0,0,0,.6);z-index:200;}
        .v-emoji-btn{width:42px;height:42px;background:none;border:none;font-size:1.5rem;cursor:pointer;border-radius:8px;transition:background .15s;display:flex;align-items:center;justify-content:center;}
        .v-emoji-btn:hover{background:#21262d;}
        .v-floating-emoji{position:absolute;bottom:10%;font-size:3rem;z-index:50;pointer-events:none;animation:floatUp 3s ease-out forwards;}
        @keyframes floatUp{0%{opacity:1;transform:translateY(0) scale(1)}50%{opacity:1;transform:translateY(-40vh) scale(1.3)}100%{opacity:0;transform:translateY(-80vh) scale(0.8)}}
      `}</style>
    </div>
  );
}
