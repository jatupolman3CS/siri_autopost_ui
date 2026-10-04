import { ApiNotifyChannel } from '../../core/http/api.service';
import { Dict } from '../../core/i18n/i18n.service';
import { SelectOption } from '../../shared/components/select-field/select-field.component';

/** The design's name of a channel; `default` is "follow the parent" and reads differently for a set and a group. */
export function channelName(
  t: Dict,
  channel: ApiNotifyChannel,
  follows: 'workspace' | 'set',
): string {
  switch (channel) {
    case 'tg':
      return t.ntf.tg;
    case 'line':
      return t.ntf.line;
    case 'both':
      return t.ntf.chBoth;
    case 'off':
      return t.ntf.chOff;
    default:
      return follows === 'set' ? t.ntf.inherit : t.ntf.chDefault;
  }
}

/** The channels a person can pick; a set or a group also has "follow the parent" first. */
export function channelOptions(t: Dict, follows: 'workspace' | 'set' | null): SelectOption[] {
  const picks = (['tg', 'line', 'both', 'off'] as const).map((value) => ({
    value,
    label: channelName(t, value, 'workspace'),
  }));
  return follows
    ? [{ value: 'default', label: channelName(t, 'default', follows) }, ...picks]
    : picks;
}
