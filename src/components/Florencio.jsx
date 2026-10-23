// Florencio, el botánico de BotanIQ: un señor entrañable con pelo y bigote blancos y peto de jardinero.
// mood: 'thinking' (mano en la barbilla, mira arriba y le salen burbujas) | 'idle' (saluda) | 'head' (solo la cara, para avatar)
export default function Florencio({ mood = 'idle', size = 96, title = 'Florencio' }) {
  const thinking = mood === 'thinking';
  const head = mood === 'head';
  const vb = head ? '18 14 84 84' : '0 0 140 140';
  return (
    <svg className={`flo flo-${mood}`} overflow={thinking ? 'hidden' : 'visible'} width={size} height={size} viewBox={vb} role="img" aria-label={title}>
      {!head && (
        <g className="flo-body">
          {/* Camisa */}
          <path d="M20 140c0-28 16-42 40-42s40 14 40 42z" fill="#f3e2bf" />
          {/* Peto */}
          <path d="M40 140v-26a4 4 0 0 1 4-4h32a4 4 0 0 1 4 4v26z" fill="#3f8f5b" />
          <path d="M44 111l-9-10M76 111l9-10" stroke="#3f8f5b" strokeWidth="7" strokeLinecap="round" />
          <circle cx="45" cy="115" r="2.6" fill="#f5c542" />
          <circle cx="75" cy="115" r="2.6" fill="#f5c542" />
          {/* Bolsillo con un brote */}
          <rect x="51" y="122" width="18" height="13" rx="3" fill="#357a4d" />
          <path d="M60 123v-7" stroke="#2e7d32" strokeWidth="2" strokeLinecap="round" />
          <path d="M60 117c-5 0-7-3-7-6 4 0 7 2 7 6zM60 116c4 0 7-3 7-6-4 0-7 2-7 6z" fill="#66bb6a" />
          {/* Cuello */}
          <rect x="52" y="82" width="16" height="20" rx="7" fill="#f2bf98" />
        </g>
      )}

      <g className="flo-head">
        {/* Orejas */}
        <circle cx="33" cy="64" r="6.5" fill="#f2bf98" />
        <circle cx="87" cy="64" r="6.5" fill="#f2bf98" />
        {/* Cara */}
        <circle cx="60" cy="62" r="27" fill="#f7cda9" />
        {/* Pelo blanco a los lados y un rizo arriba */}
        <g fill="#fbfbf8" stroke="#e3e3dc" strokeWidth="1">
          <circle cx="32" cy="54" r="7.5" /><circle cx="29" cy="62" r="7" /><circle cx="33" cy="70" r="6" />
          <circle cx="88" cy="54" r="7.5" /><circle cx="91" cy="62" r="7" /><circle cx="87" cy="70" r="6" />
          <path d="M52 37c2-6 10-8 13-3 3-4 9-1 8 4-6-3-14-4-21-1z" />
        </g>
        {/* Sombrero de paja de jardinero */}
        <g className="flo-hat">
          <ellipse cx="60" cy="42" rx="39" ry="8" fill="#e6c472" stroke="#c9a14e" strokeWidth="1.2" />
          <path d="M41 42c0-12 8-20 19-20s19 8 19 20c-6 2.5-32 2.5-38 0z" fill="#efd283" stroke="#c9a14e" strokeWidth="1.2" />
          <path d="M42 37.5c6 2.2 30 2.2 36 0l.7 4.3c-6.5 2.4-30.9 2.4-37.4 0z" fill="#3f8f5b" />
          <path d="M47 30c4-1.5 9-2 13-2M50 25.5c3-1 7-1.3 10-1.2M30 43.5c6 1.6 12 2.4 18 2.6M90 43.5c-6 1.6-12 2.4-18 2.6" stroke="#c9a14e" strokeWidth="0.9" strokeLinecap="round" fill="none" opacity="0.8" />
          <path d="M75 37c3-4 8-4 9-1-3 2-6 2-9 1z" fill="#66bb6a" />
        </g>
        {/* Cejas pobladas */}
        <g className="flo-brows" fill="#fbfbf8" stroke="#dcdcd4" strokeWidth="0.8">
          <path d="M42 52c3-4 9-5 13-2-4 2-9 3-13 2z" />
          <path d="M78 52c-3-4-9-5-13-2 4 2 9 3 13 2z" />
        </g>
        {/* Ojos (miran arriba cuando piensa) */}
        <g className="flo-eyes" transform={thinking ? 'translate(2 -2.5)' : undefined}>
          <ellipse cx="50" cy="60" rx="3" ry="3.6" fill="#3b2a20" />
          <ellipse cx="70" cy="60" rx="3" ry="3.6" fill="#3b2a20" />
          <circle cx="51" cy="58.8" r="1" fill="#fff" />
          <circle cx="71" cy="58.8" r="1" fill="#fff" />
        </g>
        {/* Mofletes y nariz */}
        <circle cx="43" cy="70" r="4.5" fill="#f19a8a" opacity="0.45" />
        <circle cx="77" cy="70" r="4.5" fill="#f19a8a" opacity="0.45" />
        <ellipse cx="60" cy="68" rx="5.5" ry="4.5" fill="#eaa57e" />
        {/* Boca (sonríe si no piensa) */}
        {thinking ? (
          <>
            <path className="flo-mouth-flat" d="M56 83.5h8" stroke="#8a4b3a" strokeWidth="1.8" strokeLinecap="round" />
            <path className="flo-mouth-smile" d="M54 82c3 3.5 9 3.5 12 0" stroke="#8a4b3a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </>
        ) : <path d="M54 82c3 3.5 9 3.5 12 0" stroke="#8a4b3a" strokeWidth="1.8" fill="none" strokeLinecap="round" />}
        {/* Bigote */}
        <path className="flo-mustache" d="M60 72.5c-7-2.5-17-1-21.5 7 6-1 10 2.5 15.5.5 3-1 5-2.6 6-4 1 1.4 3 3 6 4 5.5 2 9.5-1.5 15.5-.5-4.5-8-14.5-9.5-21.5-7z" fill="#fbfbf8" stroke="#dcdcd4" strokeWidth="1" />
      </g>

      {thinking && (
        <>
          {/* Brazo: barbilla → rascarse la cabeza → barbilla → ¡idea! (el brazo es largo para que no se vea cortado al subir) */}
          <g className="flo-hand">
            <path d="M112 210L104 140c0-14-8-26-24-38" stroke="#f3e2bf" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <g className="flo-fingers">
              <rect className="flo-index" x="73" y="80" width="5" height="12" rx="2.5" fill="#f2bf98" />
              <circle cx="76" cy="94" r="8" fill="#f2bf98" />
              <path d="M70 90c2-4 6-6 9-5" stroke="#e5ab84" strokeWidth="3" strokeLinecap="round" fill="none" />
            </g>
          </g>
          {/* Burbujas de pensamiento */}
          <g className="flo-thought">
            <circle className="b1" cx="101" cy="31" r="3" fill="var(--flo-bubble, #fff)" />
            <circle className="b2" cx="108" cy="22" r="4.5" fill="var(--flo-bubble, #fff)" />
            <g className="b3">
              <ellipse cx="121" cy="12" rx="15" ry="11" fill="var(--flo-bubble, #fff)" />
              <path className="i1" d="M121 18v-8m0 0c-5 0-7-3-7-6 4 0 7 2 7 6zm0-1c4 0 7-3 7-6-4 0-7 2-7 6z" fill="#66bb6a" stroke="#2e7d32" strokeWidth="1" />
              <path className="i2" d="M121 4c-3 4-6 7-6 10a6 6 0 0 0 12 0c0-3-3-6-6-10z" fill="#5ac8fa" />
              <circle className="i3" cx="121" cy="12" r="5" fill="#ffcc00" />
              <g className="i4">
                <path d="M121 3.5a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 121 3.5z" fill="#ffd60a" />
                <rect x="118.5" y="17.3" width="5" height="2.4" rx="1" fill="#8e8e93" />
              </g>
            </g>
          </g>
        </>
      )}
      {mood === 'idle' && (
        <g className="flo-wave">
          <path d="M100 140c0-12 2-22 8-32" stroke="#f3e2bf" strokeWidth="12" strokeLinecap="round" fill="none" />
          <circle cx="110" cy="102" r="7.5" fill="#f2bf98" />
        </g>
      )}
    </svg>
  );
}
