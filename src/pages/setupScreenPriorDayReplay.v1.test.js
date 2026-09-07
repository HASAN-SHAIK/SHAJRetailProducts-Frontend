const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'SetupScreen.jsx'), 'utf8');

describe('V1 setup prior-day replay contract', () => {
  test('replays when the stored marker is not today and advances the marker when playback starts', () => {
    expect(source).toContain("const SETUP_VIDEO_LAST_PLAYED_KEY = 'setup_video_last_played_date_v1';");
    expect(source).toContain('return lastPlayed === today;');
    expect(source).toContain('onPlay={markPlayedToday}');
    expect(source).toContain('localStorage.setItem(SETUP_VIDEO_LAST_PLAYED_KEY, getTodayKey());');
    expect(source).toContain('!skipVideoToday && (');
  });
});
