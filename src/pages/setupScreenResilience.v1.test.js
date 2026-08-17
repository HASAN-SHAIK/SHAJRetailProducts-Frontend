const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'SetupScreen.jsx'), 'utf8');

describe('V1 setup screen resilience', () => {
  test('starts the autoplay video muted so browser autoplay policy cannot block setup progress', () => {
    expect(source).toContain('const [isMuted, setIsMuted] = useState(true);');
    expect(source).toContain('autoPlay');
    expect(source).toContain('muted={isMuted}');
  });

  test('does not leave setup presentation stuck when the setup media cannot load', () => {
    expect(source).toContain('onError={() => setVideoDone(true)}');
    expect(source).toContain('onEnded={() => setVideoDone(true)}');
  });

  test('exposes setup progress and mute state accessibly', () => {
    expect(source).toContain('aria-label="Business setup progress video"');
    expect(source).toContain("aria-label={isMuted ? 'Unmute setup video' : 'Mute setup video'}");
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
  });
});