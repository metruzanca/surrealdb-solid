import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { Surreal } from 'surrealdb.js'
import { ConnectionOptions } from 'surrealdb.js/script/types'
export const db = new Surreal()

// TODO provider component that initialized the db connection

// https://surrealdb.com/docs/integration/sdks/javascript
export const connect = async (
  url: string = 'http://localhost:8000/rpc',
  options?: ConnectionOptions,
) =>
  db.connect(url, {
    ns: 'dev',
    db: 'dev',
    ...options,
  })

type PartialKey<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export function useLiveQuery<T extends Record<string, unknown>>(
  // TODO make sure thing: string is fine for other queries
  thing: string,
) {
  const [things, setThings] = createSignal<T[]>([])
  const [queryUuid, setQueryUuid] = createSignal<string>()

  onMount(async () => {
    const things = await db.select<T>(thing)
    setThings(things)
  })

  createEffect(async () => {
    const queryId = await db.live<T>(thing, ({ action, result }) => {
      console.log(`New ${action} for ${thing}`, result)

      switch (action) {
        case 'CLOSE':
          return
        case 'CREATE':
          return setThings(items => [...items, result])
        case 'DELETE':
          return setThings(items =>
            items.filter(
              item => item.id !== result, // result for DELETE is a the id
            ),
          )
        case 'UPDATE':
          return setThings(items => items.map(item => (item.id === result.id ? result : item)))
      }
    })
    setQueryUuid(queryId)
  })

  onCleanup(async () => {
    const uuid = queryUuid()
    if (uuid) {
      await db.kill(uuid)
    }
  })

  const create = async (item: PartialKey<T, 'id'>) => {
    return await db.create(thing, item)
  }

  const merge = async (thing: string, item: Partial<T>) => {
    return await db.merge(thing, item)
  }

  const remove = async (thing: string) => {
    return await db.delete(thing)
  }

  return [things, { merge, create, remove }] as const
}
