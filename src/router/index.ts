import { createRouter, createWebHistory } from 'vue-router'
import Workbench from '@/pages/Workbench.vue'

const routes = [
  {
    path: '/',
    name: 'workbench',
    component: Workbench,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
