import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Pen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STYLES = [
  {
    id: 'clean-minimal',
    name: 'Clean Minimal',
    tagline: 'Less is more — content breathes',
    vibe: 'Calm, focused, professional',
    bestFor: 'Productivity, SaaS, developer tools',
    brands: 'Linear, Notion, Stripe',
  },
  {
    id: 'soft-rounded',
    name: 'Soft & Rounded',
    tagline: 'Friendly curves, warm palettes',
    vibe: 'Approachable, trustworthy, warm',
    bestFor: 'Consumer apps, health, fintech',
    brands: 'Headspace, Calm, Monzo',
  },
  {
    id: 'bold-editorial',
    name: 'Bold Editorial',
    tagline: 'Strong type, dramatic contrast',
    vibe: 'Authoritative, premium, expressive',
    bestFor: 'Media, news, publishing, portfolios',
    brands: 'NYT, Bloomberg, Medium',
  },
  {
    id: 'glassmorphic',
    name: 'Glassmorphic',
    tagline: 'Frosted layers, depth through blur',
    vibe: 'Modern, sleek, atmospheric',
    bestFor: 'Dashboards, music, weather, lifestyle',
    brands: 'Apple, Spotify, Windows 11',
  },
  {
    id: 'neubrutalist',
    name: 'Neubrutalist',
    tagline: 'Thick borders, bold fills, raw energy',
    vibe: 'Playful, confident, rebellious',
    bestFor: 'Creative tools, social, indie products',
    brands: 'Figma, Gumroad, Poolsuite',
  },
  {
    id: 'dark-luxury',
    name: 'Dark Luxury',
    tagline: 'Deep blacks, gold accents, cinema',
    vibe: 'Premium, exclusive, sophisticated',
    bestFor: 'Finance, crypto, automotive, fashion',
    brands: 'Tesla, Robinhood, Rolex',
  },
  {
    id: 'material-elevated',
    name: 'Material / Elevated',
    tagline: 'Layered surfaces, purposeful shadow',
    vibe: 'Systematic, reliable, scalable',
    bestFor: 'Enterprise, Android, data-heavy apps',
    brands: 'Google, Android, YouTube',
  },
  {
    id: 'vibrant-playful',
    name: 'Vibrant & Playful',
    tagline: 'Saturated color, bold illustration',
    vibe: 'Fun, energetic, youthful',
    bestFor: 'Social, gaming, education, kids',
    brands: 'Duolingo, Discord, Figma',
  },
  {
    id: 'organic-natural',
    name: 'Organic / Natural',
    tagline: 'Earthy tones, flowing shapes, texture',
    vibe: 'Grounded, sustainable, human',
    bestFor: 'Wellness, food, sustainability, craft',
    brands: 'Patagonia, Aesop, Oatly',
  },
  {
    id: 'retro-nostalgic',
    name: 'Retro / Y2K',
    tagline: 'Nostalgia-coded, chrome and glow',
    vibe: 'Trendy, expressive, distinctive',
    bestFor: 'Fashion, music, Gen Z products',
    brands: 'Arc browser, Poolsuite FM',
  },
];

const MiniCleanMinimal = () => (
  <div style={{ background: '#fff', height: '100%', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'system-ui, sans-serif' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ width: 48, height: 6, background: '#111', borderRadius: 2 }} />
      <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#f3f4f6' }} />
    </div>
    <div style={{ height: 5, width: '70%', background: '#111', borderRadius: 2 }} />
    <div style={{ height: 4, width: '45%', background: '#d1d5db', borderRadius: 2 }} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? '#3b82f6' : '#e5e7eb' }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 4, width: `${70 - i*10}%`, background: '#374151', borderRadius: 1, marginBottom: 3 }} />
            <div style={{ height: 3, width: `${50 - i*5}%`, background: '#d1d5db', borderRadius: 1 }} />
          </div>
          <div style={{ height: 3, width: 20, background: '#e5e7eb', borderRadius: 1 }} />
        </div>
      ))}
    </div>
    <div style={{ height: 24, background: '#111', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 30, height: 3, background: '#fff', borderRadius: 1 }} />
    </div>
  </div>
);

const MiniSoftRounded = () => (
  <div style={{ background: '#faf7f5', height: '100%', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'system-ui' }}>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <div style={{ width: 22, height: 22, borderRadius: 10, background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }} />
      <div style={{ height: 5, width: 50, background: '#292524', borderRadius: 3 }} />
    </div>
    <div style={{ background: '#fff', borderRadius: 14, padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ height: 5, width: '60%', background: '#292524', borderRadius: 3, marginBottom: 6 }} />
      <div style={{ height: 3, width: '80%', background: '#d6d3d1', borderRadius: 2, marginBottom: 3 }} />
      <div style={{ height: 3, width: '50%', background: '#d6d3d1', borderRadius: 2 }} />
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <div style={{ height: 20, flex: 1, background: '#f59e0b', borderRadius: 10 }} />
        <div style={{ height: 20, flex: 1, background: '#fef3c7', borderRadius: 10 }} />
      </div>
    </div>
    <div style={{ display: 'flex', gap: 6 }}>
      {['#fee2e2','#dbeafe','#d1fae5'].map((c,i) => (
        <div key={i} style={{ flex: 1, height: 36, background: c, borderRadius: 12, padding: 6, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ height: 3, width: '60%', background: 'rgba(0,0,0,0.15)', borderRadius: 2 }} />
        </div>
      ))}
    </div>
  </div>
);

const MiniBoldEditorial = () => (
  <div style={{ background: '#fff', height: '100%', padding: 14, fontFamily: 'Georgia, serif', display: 'flex', flexDirection: 'column' }}>
    <div style={{ borderBottom: '2px solid #000', paddingBottom: 6, marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
      <div style={{ height: 7, width: 60, background: '#000', borderRadius: 1 }} />
      <div style={{ height: 3, width: 30, background: '#999', borderRadius: 1, alignSelf: 'flex-end' }} />
    </div>
    <div style={{ height: 7, width: '90%', background: '#000', borderRadius: 1, marginBottom: 5 }} />
    <div style={{ height: 7, width: '70%', background: '#000', borderRadius: 1, marginBottom: 10 }} />
    <div style={{ height: 3, width: '50%', background: '#999', borderRadius: 1, marginBottom: 10 }} />
    <div style={{ flex: 1, display: 'flex', gap: 8 }}>
      <div style={{ flex: 2, background: '#f5f5f5', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 20, height: 20, background: '#ddd', borderRadius: 2 }} />
      </div>
      <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[0,1,2,3,4].map(i => <div key={i} style={{ height: 3, width: `${90 - (i%2)*20}%`, background: '#ccc', borderRadius: 1 }} />)}
      </div>
    </div>
    <div style={{ borderTop: '1px solid #eee', paddingTop: 6, marginTop: 10, height: 3, width: 40, background: '#dc2626', borderRadius: 1 }} />
  </div>
);

const MiniGlassmorphic = () => (
  <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2, #f093fb)', height: '100%', padding: 14, fontFamily: 'system-ui', position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', filter: 'blur(20px)' }} />
    <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ height: 5, width: 40, background: 'rgba(255,255,255,0.8)', borderRadius: 2 }} />
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)' }} />
      </div>
      <div style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12, padding: 12, flex: 1 }}>
        <div style={{ height: 20, width: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', marginBottom: 8 }} />
        <div style={{ height: 6, width: '40%', background: 'rgba(255,255,255,0.8)', borderRadius: 2, marginBottom: 4 }} />
        <div style={{ height: 3, width: '60%', background: 'rgba(255,255,255,0.4)', borderRadius: 2 }} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, height: 32, padding: 6, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
            <div style={{ height: 2, width: '60%', background: 'rgba(255,255,255,0.4)', borderRadius: 1 }} />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const MiniNeubrutalist = () => (
  <div style={{ background: '#FFFDF5', height: '100%', padding: 12, fontFamily: 'system-ui', display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ height: 6, width: 50, background: '#000', borderRadius: 1 }} />
      <div style={{ display: 'flex', gap: 4 }}>
        {['#FFE156','#fff'].map((c,i) => (
          <div key={i} style={{ height: 16, width: 30, background: c, border: '2px solid #000', borderRadius: 4, boxShadow: i===0 ? '2px 2px 0 #000' : 'none' }} />
        ))}
      </div>
    </div>
    <div style={{ border: '2.5px solid #000', borderRadius: 10, padding: 10, background: '#C1F0C1', boxShadow: '4px 4px 0 #000' }}>
      <div style={{ height: 5, width: '70%', background: '#000', borderRadius: 1, marginBottom: 6 }} />
      <div style={{ display: 'flex', gap: 4 }}>
        {['#FFE156','#FF6B6B','#fff'].map((c,i) => (
          <div key={i} style={{ height: 12, flex: 1, background: c, border: '1.5px solid #000', borderRadius: 20 }} />
        ))}
      </div>
    </div>
    <div style={{ display: 'flex', gap: 6, flex: 1 }}>
      {[0,1].map(i => (
        <div key={i} style={{ flex: 1, border: '2.5px solid #000', borderRadius: 8, padding: 8, background: '#fff', boxShadow: '3px 3px 0 #000', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ height: 10, width: 10, background: i === 0 ? '#FF6B6B' : '#FFE156', border: '1.5px solid #000', borderRadius: 2, marginBottom: 6 }} />
            <div style={{ height: 4, width: '80%', background: '#000', borderRadius: 1, marginBottom: 3 }} />
            <div style={{ height: 3, width: '55%', background: '#999', borderRadius: 1 }} />
          </div>
          <div style={{ height: 4, background: '#eee', borderRadius: 20, border: '1.5px solid #000', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${50 + i*30}%`, background: i === 0 ? '#FF6B6B' : '#C1F0C1' }} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const MiniDarkLuxury = () => (
  <div style={{ background: '#0a0a0a', height: '100%', padding: 14, fontFamily: 'system-ui', display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ height: 5, width: 45, background: '#c9a84c', borderRadius: 1 }} />
      <div style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid #333' }} />
    </div>
    <div style={{ flex: 1, background: '#111', borderRadius: 10, border: '1px solid #222', padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
      <div style={{ height: 8, width: '50%', background: '#fff', borderRadius: 1 }} />
      <div style={{ height: 3, width: '70%', background: '#444', borderRadius: 1 }} />
      <div style={{ height: 3, width: '40%', background: '#333', borderRadius: 1 }} />
    </div>
    <div style={{ display: 'flex', gap: 6 }}>
      <div style={{ flex: 1, height: 38, background: 'linear-gradient(135deg, #c9a84c, #a07c2a)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ height: 3, width: 30, background: '#000', borderRadius: 1 }} />
      </div>
      <div style={{ flex: 1, height: 38, background: '#111', borderRadius: 8, border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ height: 3, width: 30, background: '#666', borderRadius: 1 }} />
      </div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'center', gap: 3 }}>
      {[0,1,2].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: i === 0 ? '#c9a84c' : '#333' }} />)}
    </div>
  </div>
);

const MiniMaterial = () => (
  <div style={{ background: '#fafafa', height: '100%', fontFamily: 'system-ui', display: 'flex', flexDirection: 'column' }}>
    <div style={{ background: '#1a73e8', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ height: 5, width: 45, background: 'rgba(255,255,255,0.9)', borderRadius: 1 }} />
      <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
    </div>
    <div style={{ padding: 10, flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {['#e8f0fe','#fce8e6','#e6f4ea'].map((c,i) => (
          <div key={i} style={{ flex: 1, height: 32, background: c, borderRadius: 8, padding: 6, display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ height: 3, width: '60%', background: 'rgba(0,0,0,0.15)', borderRadius: 1 }} />
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.12)', padding: 10, flex: 1 }}>
        <div style={{ height: 5, width: '55%', background: '#202124', borderRadius: 1, marginBottom: 6 }} />
        {[0,1,2].map(i => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', borderBottom: i < 2 ? '1px solid #f1f3f4' : 'none' }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: ['#1a73e8','#ea4335','#34a853'][i] + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: ['#1a73e8','#ea4335','#34a853'][i] }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ height: 3, width: `${65-i*10}%`, background: '#5f6368', borderRadius: 1 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
    <div style={{ padding: '0 14px 10px', display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1a73e8', boxShadow: '0 2px 6px rgba(26,115,232,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 300, lineHeight: 1 }}>+</div>
      </div>
    </div>
  </div>
);

const MiniVibrantPlayful = () => (
  <div style={{ background: '#fff', height: '100%', padding: 12, fontFamily: 'system-ui', display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 20, height: 20, borderRadius: 6, background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }} />
      <div style={{ height: 5, width: 40, background: '#1f2937', borderRadius: 2 }} />
    </div>
    <div style={{ background: 'linear-gradient(135deg, #fce7f3, #ede9fe)', borderRadius: 14, padding: 12, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 8 }}>
        {['#8b5cf6','#ec4899','#f59e0b'].map((c,i) => (
          <div key={i} style={{ width: 28, height: 28, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <div style={{ width: 12, height: 12, borderRadius: 4, background: c }} />
          </div>
        ))}
      </div>
      <div style={{ height: 5, width: '60%', background: '#6d28d9', borderRadius: 2, margin: '0 auto 4px' }} />
      <div style={{ height: 3, width: '80%', background: '#c4b5fd', borderRadius: 2, margin: '0 auto' }} />
    </div>
    <div style={{ display: 'flex', gap: 6 }}>
      <div style={{ flex: 1, height: 26, background: '#8b5cf6', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ height: 3, width: 24, background: '#fff', borderRadius: 1 }} />
      </div>
      <div style={{ flex: 1, height: 26, background: '#fce7f3', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ height: 3, width: 24, background: '#ec4899', borderRadius: 1 }} />
      </div>
    </div>
  </div>
);

const MiniOrganicNatural = () => (
  <div style={{ background: '#faf8f4', height: '100%', padding: 14, fontFamily: 'Georgia, serif', display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <div style={{ height: 5, width: 40, background: '#5c4033', borderRadius: 1 }} />
      <div style={{ height: 3, width: 20, background: '#a1887f', borderRadius: 1 }} />
    </div>
    <div style={{ flex: 1, borderRadius: 20, overflow: 'hidden', background: 'linear-gradient(180deg, #d4c5a9 0%, #e8dcc8 50%, #f5f0e6 100%)', padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div style={{ height: 6, width: '55%', background: '#3e2723', borderRadius: 1, marginBottom: 5 }} />
      <div style={{ height: 3, width: '75%', background: '#795548', borderRadius: 1, marginBottom: 3 }} />
      <div style={{ height: 3, width: '45%', background: '#a1887f', borderRadius: 1 }} />
    </div>
    <div style={{ display: 'flex', gap: 6 }}>
      {['#c8e6c9','#ffe0b2','#d7ccc8'].map((c,i) => (
        <div key={i} style={{ flex: 1, height: 28, background: c, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ height: 3, width: 20, background: 'rgba(0,0,0,0.2)', borderRadius: 1 }} />
        </div>
      ))}
    </div>
  </div>
);

const MiniRetroY2K = () => (
  <div style={{ background: 'linear-gradient(180deg, #1a0533, #2d1b69)', height: '100%', padding: 12, fontFamily: 'system-ui', display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ height: 5, width: 40, background: '#ff71ce', borderRadius: 1 }} />
      <div style={{ display: 'flex', gap: 3 }}>
        {['#ff71ce','#01cdfe','#b967ff'].map((c,i) => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />)}
      </div>
    </div>
    <div style={{ flex: 1, border: '1px solid rgba(255,113,206,0.3)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(255,255,255,0.05)' }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #ff71ce, #01cdfe)', opacity: 0.6 }} />
      <div style={{ height: 5, width: '50%', background: 'linear-gradient(90deg, #ff71ce, #01cdfe)', borderRadius: 2 }} />
      <div style={{ height: 3, width: '65%', background: 'rgba(255,255,255,0.2)', borderRadius: 1 }} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      {[{ bg: '#ff71ce' }, { bg: '#01cdfe' }].map((s,i) => (
        <div key={i} style={{ height: 22, background: `${s.bg}22`, border: `1px solid ${s.bg}44`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ height: 3, width: 20, background: s.bg, borderRadius: 1, opacity: 0.8 }} />
        </div>
      ))}
    </div>
  </div>
);

const miniPreviews: Record<string, () => JSX.Element> = {
  'clean-minimal': MiniCleanMinimal,
  'soft-rounded': MiniSoftRounded,
  'bold-editorial': MiniBoldEditorial,
  'glassmorphic': MiniGlassmorphic,
  'neubrutalist': MiniNeubrutalist,
  'dark-luxury': MiniDarkLuxury,
  'material-elevated': MiniMaterial,
  'vibrant-playful': MiniVibrantPlayful,
  'organic-natural': MiniOrganicNatural,
  'retro-nostalgic': MiniRetroY2K,
};

export default function StylePickerPage() {
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customStyle, setCustomStyle] = useState({ name: "", description: "" });

  const selectedStyle = STYLES.find(s => s.id === selected);
  const isCustomSelected = selected === "custom";

  const canContinue = selected !== null && (
    !isCustomSelected || (customStyle.name.trim() && customStyle.description.trim())
  );

  const handleContinue = () => {
    const styleData = isCustomSelected
      ? { id: "custom", name: customStyle.name, description: customStyle.description }
      : selectedStyle
        ? { id: selectedStyle.id, name: selectedStyle.name, tagline: selectedStyle.tagline, vibe: selectedStyle.vibe, bestFor: selectedStyle.bestFor, brands: selectedStyle.brands }
        : null;

    if (styleData) {
      sessionStorage.setItem("appStyle", JSON.stringify(styleData));
    }
    setLocation("/details");
  };

  return (
    <div className="min-h-screen bg-surface-secondary">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 py-8">
        <div className="mb-8">
          <p className="text-metadata text-contrast-medium uppercase tracking-widest mb-2">
            Style Selection
          </p>
          <h1 className="text-h3 sm:text-h2 font-bold text-contrast-high tracking-tight leading-tight">
            Choose your app's visual direction
          </h1>
          <p className="text-description text-contrast-medium mt-2 max-w-xl leading-relaxed">
            Each style carries different psychological signals. Pick the one that matches your product's personality — or define your own.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
          {STYLES.map((style) => {
            const Preview = miniPreviews[style.id];
            const isSelected = selected === style.id;
            const isHoveredItem = hovered === style.id;

            return (
              <div
                key={style.id}
                onClick={() => { setSelected(isSelected ? null : style.id); setShowCustom(false); }}
                onMouseEnter={() => setHovered(style.id)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-pointer rounded-2xl overflow-hidden transition-all duration-200"
                style={{
                  background: '#fff',
                  border: isSelected ? '2px solid #111' : '2px solid transparent',
                  boxShadow: isSelected
                    ? '0 4px 20px rgba(0,0,0,0.15)'
                    : isHoveredItem
                      ? '0 4px 16px rgba(0,0,0,0.1)'
                      : '0 1px 4px rgba(0,0,0,0.06)',
                  transform: isHoveredItem && !isSelected ? 'translateY(-3px)' : 'translateY(0)',
                }}
                data-testid={`style-card-${style.id}`}
              >
                <div className="h-[160px] sm:h-[180px]">
                  <Preview />
                </div>
                <div className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-1">
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-black flex items-center justify-center shrink-0">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    )}
                    <span className="text-title font-semibold text-contrast-high leading-tight truncate">{style.name}</span>
                  </div>
                  <p className="text-metadata text-contrast-medium leading-snug">{style.tagline}</p>
                </div>
              </div>
            );
          })}

          <div
            onClick={() => { setSelected("custom"); setShowCustom(true); }}
            onMouseEnter={() => setHovered("custom")}
            onMouseLeave={() => setHovered(null)}
            className="cursor-pointer rounded-2xl overflow-hidden transition-all duration-200"
            style={{
              background: '#fff',
              border: isCustomSelected ? '2px solid #111' : '2px solid transparent',
              boxShadow: isCustomSelected
                ? '0 4px 20px rgba(0,0,0,0.15)'
                : hovered === 'custom'
                  ? '0 4px 16px rgba(0,0,0,0.1)'
                  : '0 1px 4px rgba(0,0,0,0.06)',
              transform: hovered === 'custom' && !isCustomSelected ? 'translateY(-3px)' : 'translateY(0)',
            }}
            data-testid="style-card-custom"
          >
            <div className="h-[160px] sm:h-[180px] flex items-center justify-center bg-gray-50 border-b-2 border-dashed border-gray-200">
              <div className="text-center">
                <Pen className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-description text-contrast-medium">Define your own</p>
              </div>
            </div>
            <div className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-1">
                {isCustomSelected && (
                  <div className="w-4 h-4 rounded-full bg-black flex items-center justify-center shrink-0">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
                <span className="text-title font-semibold text-contrast-high leading-tight">Custom Style</span>
              </div>
              <p className="text-metadata text-contrast-medium leading-snug">Describe your vision</p>
            </div>
          </div>
        </div>

        {selectedStyle && !isCustomSelected && (
          <div className="mt-6 bg-surface-primary rounded-lg border border-gray-200 p-5 animate-in fade-in duration-300">
            <div className="flex flex-wrap gap-x-8 gap-y-3 text-description">
              <div><span className="text-contrast-medium">Vibe:</span> <span className="text-contrast-high font-medium">{selectedStyle.vibe}</span></div>
              <div><span className="text-contrast-medium">Best for:</span> <span className="text-contrast-high font-medium">{selectedStyle.bestFor}</span></div>
              <div><span className="text-contrast-medium">Used by:</span> <span className="text-contrast-high font-medium">{selectedStyle.brands}</span></div>
            </div>
          </div>
        )}

        {showCustom && isCustomSelected && (
          <div className="mt-6 bg-surface-primary rounded-lg border border-gray-200 p-5 space-y-4 animate-in fade-in duration-300">
            <div>
              <Label className="text-title font-medium text-contrast-high mb-1 block">Style name</Label>
              <Input
                value={customStyle.name}
                onChange={(e) => setCustomStyle(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Corporate Tech, Scandinavian Clean, Cyberpunk Neon"
                data-testid="input-custom-style-name"
              />
            </div>
            <div>
              <Label className="text-title font-medium text-contrast-high mb-1 block">Describe the look and feel</Label>
              <Textarea
                value={customStyle.description}
                onChange={(e) => setCustomStyle(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g., Muted blue-gray palette, lots of whitespace, subtle shadows, rounded corners, Inter font. Think Notion meets Linear but warmer."
                className="min-h-[100px]"
                data-testid="input-custom-style-description"
              />
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-4 mt-8">
          <Button
            onClick={handleContinue}
            disabled={!canContinue}
            className="btn-primary min-h-[52px] px-10 text-body w-full sm:w-auto"
            data-testid="button-continue-to-details"
          >
            Continue
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <button
            onClick={() => {
              sessionStorage.removeItem("appStyle");
              setLocation("/details");
            }}
            className="text-description text-contrast-medium hover:text-accent"
            data-testid="button-skip-style"
          >
            Skip this step
          </button>
        </div>

        <div className="mt-8">
          <button
            onClick={() => setLocation("/")}
            className="text-description text-contrast-medium hover:text-accent"
            data-testid="button-back-home"
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
