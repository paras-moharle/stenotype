'use client';

import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';

export function ChoiceMenu<T extends string>({ label, value, options, onChange, disabled, placeholder }: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <Select.Root value={value} disabled={disabled} onValueChange={(next) => {
      const selected = options.find(option => option.value === next);
      if (selected) onChange(selected.value);
    }}>
      <Select.Trigger aria-label={label} className="choice-trigger">
        <Select.Value placeholder={placeholder} />
        <Select.Icon><ChevronDown size={15} /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={6} collisionPadding={10} className="choice-menu">
          <Select.Viewport>
            {options.map(option => (
              <Select.Item key={option.value} value={option.value} className="choice-option">
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator><Check size={15} /></Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
