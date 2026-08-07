/**
 * Tests for shared types
 */

import { VersionInfo, VersionDetails, LaunchConfig, JavaInfo } from '../renderer/types';

describe('TypeScript Types', () => {
  it('should define VersionInfo type correctly', () => {
    const version: VersionInfo = {
      id: '1.20.4',
      type: 'release',
      time: '2024-01-01T00:00:00Z',
      releaseTime: '2024-01-01T00:00:00Z',
      url: 'https://example.com/version.json',
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

  it('should define VersionDetails type correctly', () => {
    const details: VersionDetails = {
      id: '1.20.4',
      type: 'release',
      time: '2024-01-01T00:00:00Z',
      releaseTime: '2024-01-01T00:00:00Z',
      mainClass: 'net.minecraft.client.main.Main',
      assets: '1.20',
      libraries: [],
      downloads: {
        artifact: {
          url: 'https://example.com/client.jar',
          sha1: 'abc123',
          size: 12345,
        },
      },
    };

    expect(details.id).toBe('1.20.4');
    expect(details.downloads?.artifact?.url).toBe('https://example.com/client.jar');
  });
});