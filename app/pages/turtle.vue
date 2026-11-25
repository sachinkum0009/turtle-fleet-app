<script setup lang="ts">
const { robots, loading, problem, reload } = useRobots()
onMounted(reload)
// shortcut: picks the robot named "turtle", else the first one; add a picker once the app attaches more robots.
const robot = computed(() => robots.value.find(r => r.name === 'turtle') ?? robots.value[0] ?? null)
</script>

<template>
  <TurtleConsole v-if="robot" :key="robot.id" :robot-id="robot.id" />
  <UDashboardPanel v-else id="turtle">
    <template #header>
      <UDashboardNavbar title="Control turtle">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <UAlert
        v-if="problem"
        color="error"
        variant="subtle"
        :title="problem"
      />
      <p v-else class="text-sm text-muted">
        {{ loading ? 'Looking for the turtle.' : 'No robot reachable. Your role reaches nothing on any robot of this app.' }}
      </p>
    </template>
  </UDashboardPanel>
</template>
