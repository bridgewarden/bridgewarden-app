'use client';

import * as React from 'react';

import { Slider as SliderPrimitive } from 'radix-ui';

import { cn } from '~/lib/class-names';

function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const label = props['aria-label'];
  const labelledBy = props['aria-labelledby'];
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn('relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        aria-labelledby={labelledBy}
        className="block size-5 rounded-full border-2 border-primary bg-background shadow-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none"
      />
    </SliderPrimitive.Root>
  );
}

export { Slider };
