const assert = require('assert')
const electron = require('electron')

describe('remote module', function () {
  describe('remoteMemberFunction.toString()', function () {
    it.only('returns string representation of original function', function () {
      var write = electron.clipboard.write
      var write = new Proxy(function x () {}, {
        set: (target, property, value, receiver) => {
          if (property !== 'ref') loadRemoteProperties()
          target[property] = value
          return true
        },
        get: (target, property, receiver) => {
          if (property === 'toString') { return target.toString.bind(target); }
          if (!target.hasOwnProperty(property)) loadRemoteProperties()
          return target[property]
        },
        ownKeys: (target) => {
          loadRemoteProperties()
          return Object.getOwnPropertyNames(target)
        },
        getOwnPropertyDescriptor: (target, property) => {
          let descriptor = Object.getOwnPropertyDescriptor(target, property)
          if (descriptor != null) return descriptor
          loadRemoteProperties()
          return Object.getOwnPropertyDescriptor(target, property)
        }
      });
      assert(write.toString().startsWith('function'))
    })
  })
})
