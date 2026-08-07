/**
 * Tests for shared types
 */

import { VersionInfo, LaunchConfig, JavaInfo } from '../renderer/types';

describe('TypeScript Types', () => {
  it('should define VersionInfo type correctly', () => {
    const version: VersionInfo = {
      id: '1.20.4',
      type: 'release',
      time: '2024-01-01T00:00:00Z',
      releaseTime: '2024-01-01T00:00:00Z',
      mainClass: 'net.minecraft.client.main.Main',
      assets: '1.20',
      libraries: [],
      downloads: {},
    };

    expect(version.id).toBe('1.20.4');
    expect(version.type).toBe('release');
  });

  it('should define LaunchConfig type correctly', () => {
    const config: LaunchConfig = {
      version: '1.20.4',
      nickname: 'TestPlayer',
      javaPath: '/usr/bin/java',
      gameDir: '/home/user/.minecraft',
    };

    expect(config.version).toBe('1.20.4');
    expect(config.nickname).toBe('TestPlayer');
  });

  it('should define JavaInfo type correctly', () => {
    const java: JavaInfo = {
      path: '/usr/bin/java',
      version: '17',
      valid: true,
    };

    expect(java.valid).toBe(true);
  });
});