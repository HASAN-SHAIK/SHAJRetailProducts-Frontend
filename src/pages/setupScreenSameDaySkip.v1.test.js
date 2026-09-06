const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'SetupScreen.jsx'), 'utf8');

describe('V1 setup screen same-day replay suppression', () => {
  test('uses a date-scoped localStorage marker to skip repeated setup video playback', () => {
    expect(source).toContain("const SETUP_VIDEO_LAST_PLAYED_KEY = 'setup_video_last_played_date_v1';");
    expect(source).toContain('const lastPlayed = localStorage.getItem(SETUP_VIDEO_LAST_PLAYED_KEY);');
    expect(source).toContain('return lastPlayed === today;');
  });

  test('immediately marks setup presentation complete when same-day playback is skipped', () => {
    expect(source).toContain('if (skipVideoToday) {');
    expect(source).toContain('setVideoDone(true);');
    expect(source).toContain('{!skipVideoToday && (');
  });
});
