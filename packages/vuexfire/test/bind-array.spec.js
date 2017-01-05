import test from 'ava'
import Vue from 'vue'
import Vuex from 'vuex'
import { MockFirebase } from 'firebase-mock'

import VuexFire, {
  mutations,
  generateBind
} from '../src'

const root = new MockFirebase()

test.before(t => {
  Vue.use(Vuex)
})

test.beforeEach(t => {
  t.context.store = new Vuex.Store({
    state: {
      items: []
    },
    actions: {
      setItemsRef (context, ref) {
        bind('items', ref)
      },
      unbindItemsRef (context) {
        unbind('items')
      }
    },
    mutations: {
      ...mutations
    },
    plugins: [VuexFire]
  })

  const { bind, unbind } = generateBind(t.context.store)

  // Create a fresh ref for the test
  const ref = root.push({})
  root.flush()
  t.context.ref = ref
})

test('binds an array of objects', t => {
  t.context.store.dispatch('setItemsRef', t.context.ref)
  t.context.ref.set({
    first: { index: 0 },
    second: { index: 1 },
    third: { index: 2 }
  })
  t.context.ref.flush()

  t.deepEqual(t.context.store.state.items, [
    { '.key': 'first', index: 0 },
    { '.key': 'second', index: 1 },
    { '.key': 'third', index: 2 }
  ])
  t.context.ref.child('first').child('index').set(3)
  t.context.ref.flush()
  t.deepEqual(t.context.store.state.items[0].index, 3)
})

test('binds an array of primitives', t => {
  t.context.store.dispatch('setItemsRef', t.context.ref)
  t.context.ref.set([0, 1, 2])
  t.context.ref.flush()

  t.deepEqual(t.context.store.state.items, [
    { '.key': '0', '.value': 0 },
    { '.key': '1', '.value': 1 },
    { '.key': '2', '.value': 2 }
  ])
})

test('binds a mixed array', t => {
  t.context.store.dispatch('setItemsRef', t.context.ref)
  t.context.ref.set({
    0: 'first',
    1: 'second',
    third: { index: 2 }
  })
  t.context.ref.flush()

  t.deepEqual(t.context.store.state.items, [
    { '.key': '0', '.value': 'first' },
    { '.key': '1', '.value': 'second' },
    { '.key': 'third', index: 2 }
  ])
})

test('binds to a reference array with no data', t => {
  t.context.store.dispatch('setItemsRef', t.context.ref.child('foo'))
  t.context.ref.flush()

  t.deepEqual(t.context.store.state.items, [])
})

test('add records to the array', t => {
  t.context.store.dispatch('setItemsRef', t.context.ref)
  t.context.ref.set({
    first: { index: 0 },
    second: { index: 1 },
    third: { index: 2 }
  })
  t.context.ref.flush()
  t.context.ref.child('fourth').set({ index: 3 })
  t.context.ref.flush()

  // MockFirebase doesn't keep order :(
  const sorted = [...t.context.store.state.items].sort((a, b) => a.index - b.index)
  t.deepEqual(sorted, [
    { '.key': 'first', index: 0 },
    { '.key': 'second', index: 1 },
    { '.key': 'third', index: 2 },
    { '.key': 'fourth', index: 3 }
  ])
})

// // limit is not yet fully implemented in firebase mock
// test('binds to a subset of records when using limit queries', t => {
//   t.context.store.dispatch('setItemsRef', t.context.ref.limit(2))
//   t.context.ref.set({ a: 0, b: 1, c: 2 })
//   t.context.ref.flush()
//   t.deepEqual(t.context.store.state.items, [{ '.key': 'c', '.value': 2 }])
// })

test('unbinds an array reference', t => {
  const foo = t.context.ref.child('foo')
  t.context.store.dispatch('setItemsRef', foo)

  foo.child('foo').set('foo')
  t.context.ref.flush()
  t.deepEqual(t.context.store.state.items, [{'.key': 'foo', '.value': 'foo'}])

  t.context.store.dispatch('unbindItemsRef')
  foo.child('foo').set('foo 2')
  t.context.ref.flush()
  t.deepEqual(t.context.store.state.items, [{'.key': 'foo', '.value': 'foo'}])
})

test('unbinds old array reference when binding a new one', t => {
  const foo = t.context.ref.child('foo')
  const bar = t.context.ref.child('bar')
  t.context.store.dispatch('setItemsRef', foo)

  foo.child('foo').set('foo')
  t.context.ref.flush()
  t.deepEqual(t.context.store.state.items, [{'.key': 'foo', '.value': 'foo'}])

  t.context.store.dispatch('setItemsRef', bar)
  bar.child('bar').set('bar')
  t.context.ref.flush()
  t.deepEqual(t.context.store.state.items, [{'.key': 'bar', '.value': 'bar'}])

  foo.child('foo').set('foo 2')
  t.context.ref.flush()
  t.deepEqual(t.context.store.state.items, [{'.key': 'bar', '.value': 'bar'}])
})

