const assert = require('assert')
const electron = require('electron')

describe('remote module', function () {
  describe('remoteMemberFunction.toString()', function () {
    it('returns string representation of original function', function () {
      var write = electron.clipboard.write
      assert(write.toString().startsWith('function'))
    })
  })
})
