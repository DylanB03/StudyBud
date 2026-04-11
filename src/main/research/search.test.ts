import { describe, expect, it } from 'vitest';

import { __testables__ } from './search';

describe('research search parsers', () => {
  it('extracts usable web results from DuckDuckGo html', () => {
    const html = `
      <div class="results">
        <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fbayes">
          Bayes theorem explained
        </a>
        <a class="result__snippet">
          A visual introduction to conditional probability and Bayes theorem.
        </a>
        <a class="result__a" href="https://example.com/posterior">
          Posterior probability intuition
        </a>
        <div class="result__snippet">
          Why priors and likelihoods combine into a posterior belief update.
        </div>
      </div>
    `;

    const results = __testables__.parseDuckDuckGoResults(html);

    expect(results).toHaveLength(2);
    expect(results[0]?.url).toBe('https://example.com/bayes');
    expect(results[0]?.snippet).toContain('conditional probability');
    expect(results[1]?.title).toContain('Posterior probability');
  });

  it('extracts video suggestions from YouTube search html', () => {
    const html = `
      <script>
        var ytInitialData = {
          "contents": {
            "twoColumnSearchResultsRenderer": {
              "primaryContents": {
                "sectionListRenderer": {
                  "contents": [{
                    "itemSectionRenderer": {
                      "contents": [{
                        "videoRenderer": {
                          "videoId": "abc123",
                          "title": { "runs": [{ "text": "Bayes theorem tutorial" }] },
                          "ownerText": { "runs": [{ "text": "Math Visualized" }] },
                          "lengthText": { "simpleText": "12:34" },
                          "thumbnail": {
                            "thumbnails": [
                              { "url": "https://i.ytimg.com/vi/abc123/default.jpg" },
                              { "url": "https://i.ytimg.com/vi/abc123/hqdefault.jpg" }
                            ]
                          }
                        }
                      }]
                    }
                  }]
                }
              }
            }
          }
        };
      </script>
    `;

    const results = __testables__.parseYouTubeVideos(
      html,
      'bayes theorem tutorial',
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.url).toBe('https://www.youtube.com/watch?v=abc123');
    expect(results[0]?.channel).toBe('Math Visualized');
    expect(results[0]?.duration).toBe('12:34');
  });
});
