import React from 'react';

import armourSvg from '../../icons/24/armour.svg?raw';
import commandSvg from '../../icons/24/command.svg?raw';
import elitesSvg from '../../icons/24/elites.svg?raw';
import fastAttackSvg from '../../icons/24/fast-attack.svg?raw';
import heavyAssaultSvg from '../../icons/24/heavy-assault.svg?raw';
import heavyTransportSvg from '../../icons/24/heavy-transport.svg?raw';
import highCommandSvg from '../../icons/24/high-command.svg?raw';
import lordOfWarSvg from '../../icons/24/lord-of-war.svg?raw';
import reconSvg from '../../icons/24/recon.svg?raw';
import retinueSvg from '../../icons/24/retinue.svg?raw';
import supportSvg from '../../icons/24/support.svg?raw';
import transportSvg from '../../icons/24/transport.svg?raw';
import troopsSvg from '../../icons/24/troops.svg?raw';
import warEngineSvg from '../../icons/24/war-engine.svg?raw';
import warlordSvg from '../../icons/24/warlord.svg?raw';

const ROLE_SVGS: Record<string, string> = {
  Armour: armourSvg,
  Command: commandSvg,
  Elites: elitesSvg,
  'Fast Attack': fastAttackSvg,
  'Heavy Assault': heavyAssaultSvg,
  'Heavy Transport': heavyTransportSvg,
  'High Command': highCommandSvg,
  'Lord of War': lordOfWarSvg,
  'Lord Of War': lordOfWarSvg,
  Recon: reconSvg,
  Retinue: retinueSvg,
  Support: supportSvg,
  Transport: transportSvg,
  Troops: troopsSvg,
  'War Engine': warEngineSvg,
  'War-engine': warEngineSvg,
  Warlord: warlordSvg,
};

// Fallback: simple circle
const FALLBACK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>';

interface RoleIconProps {
  role: string;
  size?: number;
  className?: string;
}

export default function RoleIcon({ role, size = 24, className = '' }: RoleIconProps) {
  const raw = ROLE_SVGS[role] ?? FALLBACK_SVG;
  // Inject width/height into the <svg> opening tag so it respects the size prop
  const sized = raw.replace('<svg', `<svg width="${size}" height="${size}"`);

  return (
    <span
      className={className}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: sized }}
      aria-label={role}
    />
  );
}
