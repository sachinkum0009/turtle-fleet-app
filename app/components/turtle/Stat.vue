<script setup lang="ts">
import { formatValue } from '~/utils/format'

const props = defineProps<{ robotId: string, slug: string, label: string, unit?: string | null, decimals?: number | null }>()
const { value, problem } = useDatapoint(props.robotId, props.slug)
</script>

<template>
  <div class="rounded-md border border-default px-3 py-2">
    <p class="text-xs text-muted">
      {{ label }}
    </p>
    <p v-if="problem" class="text-sm text-error">
      {{ problem }}
    </p>
    <p v-else class="text-lg font-semibold tabular-nums truncate">
      {{ value === undefined ? '–' : formatValue(value, decimals ?? null) }}<span v-if="unit && value !== undefined" class="text-sm text-muted ml-1">{{ unit }}</span>
    </p>
  </div>
</template>
