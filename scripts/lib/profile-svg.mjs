import { escapeXml, renderPublicBuilderSvg } from './svg.mjs';
import { renderPublicWorkSvg } from './work-svg.mjs';

function section(svg, id, y) {
  const [, width, height] = svg.match(/^<svg[^>]*width="(\d+)" height="(\d+)"/);
  const markup = svg.replace('<svg ', `<svg id="${id}" y="${y}" `)
    .replace(/<style>([\s\S]*?)<\/style>/, (_, css) => {
      const scoped = css.replace(/^(\s*)([^{}\n]+)\s*\{/gm,
        (_, indent, selector) => `${indent}#${id} ${selector.trim()} {`);
      return `<style>${scoped}</style>`;
    });
  return { width: Number(width), height: Number(height), markup };
}

export function renderProfileSvg(snapshot, history = [], options = {}) {
  const overview = section(renderPublicBuilderSvg(snapshot, history, options), 'profile-overview', 0);
  const work = section(renderPublicWorkSvg(snapshot, options), 'profile-work', overview.height);
  const height = overview.height + work.height;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${overview.width}" height="${height}" viewBox="0 0 ${overview.width} ${height}" role="img" aria-labelledby="profile-title profile-description">
  <title id="profile-title">${escapeXml(snapshot.profile.name)} public builder profile</title>
  <desc id="profile-description">Public GitHub statistics, ecosystem roles, tech stack, top repositories, and selected contributions in one continuous blueprint.</desc>
  ${overview.markup}
  ${work.markup}
</svg>`;
}
