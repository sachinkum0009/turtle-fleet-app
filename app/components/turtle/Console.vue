<script setup lang="ts">
import type { McpExposure } from '@fleetless/sdk'
import { useEventListener, useIntervalFn } from '@vueuse/core'
import { driveKeyFor, SQUARE_PATTERN, twistFor, type DriveKey } from '~/utils/teleop'

const props = defineProps<{ robotId: string }>()
const client = useFleetless()
const { sheet, loading, problem: sheetProblem, reload, onError } = useDatasheet(props.robotId)
onMounted(reload)

const exposure = (slug: string): McpExposure | undefined => sheet.value?.exposures.find(e => e.slug === slug)
const has = (slug: string) => exposure(slug) !== undefined
const problem = ref<string | null>(null)
async function attempt(run: () => Promise<unknown>) {
  problem.value = null
  try {
    await run()
  } catch (error) {
    problem.value = await onError(error)
  }
}

// Drive by hand: `drive` holds for 0.5 s per message, so resend at 10 Hz while a key is held.
const held = reactive(new Set<DriveKey>())
const speed = ref(60)
const publish = (message: Record<string, unknown>) => attempt(() => client.publishers.publish(props.robotId, 'drive', message))
const loop = useIntervalFn(() => publish(twistFor(held, speed.value / 100)), 100, { immediate: false, immediateCallback: true })

function press(key: DriveKey) {
  if (!has('drive')) return
  held.add(key)
  if (!loop.isActive.value) loop.resume()
}
function release(key?: DriveKey) {
  if (key) held.delete(key)
  else held.clear()
  if (held.size > 0 || !loop.isActive.value) return
  loop.pause()
  void publish({ linear_speed: 0, angular_speed: 0 })
}

const typing = (event: KeyboardEvent) => event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]') !== null
useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  const key = driveKeyFor(event.key)
  if (!key || typing(event) || event.repeat) return
  event.preventDefault()
  press(key)
})
useEventListener(window, 'keyup', (event: KeyboardEvent) => {
  const key = driveKeyFor(event.key)
  if (key) release(key)
})
// A key released outside the window never sends keyup: stop rather than drive on.
useEventListener(window, 'blur', () => release())
useEventListener(document, 'visibilitychange', () => release())
onBeforeUnmount(() => release())

const PAD: { key: DriveKey, icon: string, label: string, cell: string }[] = [
  { key: 'forward', icon: 'i-lucide-arrow-up', label: 'Forward', cell: 'col-start-2' },
  { key: 'left', icon: 'i-lucide-arrow-left', label: 'Turn left', cell: 'col-start-1 row-start-2' },
  { key: 'back', icon: 'i-lucide-arrow-down', label: 'Backward', cell: 'col-start-2 row-start-2' },
  { key: 'right', icon: 'i-lucide-arrow-right', label: 'Turn right', cell: 'col-start-3 row-start-2' }
]

// Goals
const square = ref('')
const squareValid = computed(() => SQUARE_PATTERN.test(square.value.trim().toUpperCase()))
const goals = { drive_to_square: useJob(props.robotId, 'drive_to_square'), dock: useJob(props.robotId, 'dock') }
const running = computed(() => (Object.keys(goals) as (keyof typeof goals)[]).find(slug => goals[slug].running.value) ?? null)
const lastGoal = ref<keyof typeof goals | null>(null)
const shown = computed(() => {
  const slug = running.value ?? lastGoal.value
  return slug ? { slug, ...goals[slug] } : null
})
const resultOf = (value: unknown) => (value && typeof value === 'object' ? value as { message?: string } : null)

function start(slug: keyof typeof goals, params: Record<string, unknown>) {
  lastGoal.value = slug
  return attempt(() => client.actions.invoke(props.robotId, slug, params))
}
function cancel() {
  const slug = running.value
  if (slug) void attempt(() => client.actions.cancel(props.robotId, slug))
}

const trail = ref(false)
const serviceMessage = ref<string | null>(null)
async function callService(slug: string, params: Record<string, unknown>) {
  serviceMessage.value = null
  await attempt(async () => {
    const reply = await client.services.call(props.robotId, slug, params)
    serviceMessage.value = resultOf(reply)?.message ?? null
  })
}
async function toggleTrail() {
  await callService('set_trail', { record: !trail.value })
  if (!problem.value) trail.value = !trail.value
}
async function reset() {
  await callService('reset', {})
  if (!problem.value) trail.value = false
}

const STATS = [
  { slug: 'mode', label: 'Mode' },
  { slug: 'battery_soc', label: 'Battery' },
  { slug: 'square', label: 'Square' },
  { slug: 'heading', label: 'Heading' },
  { slug: 'speed', label: 'Speed' },
  { slug: 'range_front', label: 'Front' },
  { slug: 'bumper', label: 'Bumper' },
  { slug: 'on_charger', label: 'On charger' }
]
const MORE = ['drive_to', 'teleport', 'set_block']
</script>

<template>
  <UDashboardPanel :id="`turtle-${robotId}`">
    <template #header>
      <UDashboardNavbar :title="`Control ${sheet?.robot_name ?? 'turtle'}`">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            :to="`/robots/${robotId}`"
            label="All details"
            color="neutral"
            variant="ghost"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="sheetProblem"
        color="error"
        variant="subtle"
        :title="sheetProblem"
      />
      <p v-else-if="loading && !sheet" class="text-sm text-muted">
        Loading the robot.
      </p>
      <div v-else-if="sheet" class="flex flex-col gap-4">
        <UAlert
          v-if="problem"
          color="error"
          variant="subtle"
          :title="problem"
          :close="true"
          @update:open="problem = null"
        />

        <div class="grid gap-2 grid-cols-2 sm:grid-cols-4 xl:grid-cols-8">
          <template v-for="s in STATS" :key="s.slug">
            <TurtleStat
              v-if="exposure(s.slug)"
              :robot-id="robotId"
              :slug="s.slug"
              :label="s.label"
              :unit="exposure(s.slug)!.unit"
              :decimals="exposure(s.slug)!.decimals"
            />
          </template>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <RobotCameraPanel v-if="exposure('top')" :robot-id="robotId" :exposure="exposure('top')!" />
          <RobotCameraPanel v-if="exposure('eye')" :robot-id="robotId" :exposure="exposure('eye')!" />
        </div>

        <div class="grid gap-4 lg:grid-cols-3">
          <UCard v-if="has('drive')">
            <template #header>
              <p class="font-medium">
                Drive
              </p>
              <p class="text-xs text-muted">
                Hold a button, or the arrow keys / WASD. The turtle stops when you let go.
              </p>
            </template>
            <div class="grid grid-cols-3 grid-rows-2 gap-2 w-fit mx-auto select-none touch-none">
              <UButton
                v-for="b in PAD"
                :key="b.key"
                :icon="b.icon"
                :aria-label="b.label"
                size="xl"
                :variant="held.has(b.key) ? 'solid' : 'outline'"
                :class="b.cell"
                @pointerdown.prevent="press(b.key)"
                @pointerup="release(b.key)"
                @pointerleave="release(b.key)"
                @pointercancel="release(b.key)"
              />
            </div>
            <UFormField :label="`Speed ${speed} %`" class="mt-4">
              <USlider v-model="speed" :min="10" :max="100" :step="10" />
            </UFormField>
          </UCard>

          <UCard>
            <template #header>
              <p class="font-medium">
                Go somewhere
              </p>
            </template>
            <form
              v-if="has('drive_to_square')"
              class="flex gap-2"
              @submit.prevent="squareValid && start('drive_to_square', { square: square.trim().toUpperCase() })"
            >
              <UInput
                v-model="square"
                placeholder="Square, A1 to P16"
                aria-label="Square"
                class="flex-1"
              />
              <UButton type="submit" label="Go" :disabled="!squareValid" />
            </form>
            <UButton
              v-if="has('dock')"
              class="mt-2"
              block
              icon="i-lucide-battery-charging"
              label="Dock and charge"
              color="neutral"
              variant="outline"
              @click="start('dock', {})"
            />
            <div v-if="shown?.event.value" class="mt-4 flex flex-col gap-2 text-sm">
              <div class="flex items-center gap-2">
                <span class="font-mono text-xs">{{ shown.slug }}</span>
                <UBadge :color="shown.running.value ? 'primary' : shown.event.value.job.state === 'succeeded' ? 'success' : 'neutral'" variant="subtle">
                  {{ shown.event.value.job.state }}
                </UBadge>
                <UButton
                  v-if="shown.running.value"
                  label="Stop"
                  size="xs"
                  color="error"
                  class="ml-auto"
                  @click="cancel"
                />
              </div>
              <UProgress
                v-if="shown.running.value"
                :model-value="shown.event.value.progress === null ? null : shown.event.value.progress * 100"
              />
              <p v-if="resultOf(shown.event.value.job.result)?.message" class="text-muted">
                {{ resultOf(shown.event.value.job.result)!.message }}
              </p>
              <p v-if="shown.event.value.job.error" class="text-error">
                {{ shown.event.value.job.error.message }}
              </p>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <p class="font-medium">
                Simulator
              </p>
            </template>
            <div class="flex flex-col gap-2">
              <UButton
                v-if="has('set_trail')"
                block
                icon="i-lucide-route"
                :label="trail ? 'Stop and clear trail' : 'Record trail'"
                color="neutral"
                variant="outline"
                @click="toggleTrail"
              />
              <UButton
                v-if="has('reset')"
                block
                icon="i-lucide-rotate-ccw"
                label="Reset everything"
                color="warning"
                variant="outline"
                @click="reset"
              />
              <p v-if="serviceMessage" class="text-sm text-muted">
                {{ serviceMessage }}
              </p>
            </div>
          </UCard>
        </div>

        <details>
          <summary class="cursor-pointer text-sm text-muted">
            More commands
          </summary>
          <div class="grid gap-4 lg:grid-cols-3 mt-4">
            <template v-for="slug in MORE" :key="slug">
              <RobotCommandPanel v-if="exposure(slug)" :robot-id="robotId" :exposure="exposure(slug)!" />
            </template>
          </div>
        </details>
      </div>
    </template>
  </UDashboardPanel>
</template>
