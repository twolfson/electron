const ipcRenderer = require('electron').ipcRenderer;
const remote = require('electron').remote;

var slice = [].slice;

// Cache browser window visibility
var _isVisible = true;
var _isMinimized = false;
(function() {
  var currentWindow;
  currentWindow = remote.getCurrentWindow();
  _isVisible = currentWindow.isVisible();
  _isMinimized = currentWindow.isMinimized();
})();

// Helper function to resolve relative url.
var a = window.top.document.createElement('a');

var resolveURL = function(url) {
  a.href = url;
  return a.href;
};

// Window object returned by "window.open".
var BrowserWindowProxy = (function() {
  BrowserWindowProxy.proxies = {};

  BrowserWindowProxy.getOrCreate = function(guestId) {
    var base;
    return (base = this.proxies)[guestId] != null ? base[guestId] : base[guestId] = new BrowserWindowProxy(guestId);
  };

  BrowserWindowProxy.remove = function(guestId) {
    return delete this.proxies[guestId];
  };

  function BrowserWindowProxy(guestId1) {
    this.guestId = guestId1;
    this.closed = false;
    ipcRenderer.once("ATOM_SHELL_GUEST_WINDOW_MANAGER_WINDOW_CLOSED_" + this.guestId, (function(_this) {
      return function() {
        BrowserWindowProxy.remove(_this.guestId);
        return (_this.closed = true);
      };
    })(this));
  }

  BrowserWindowProxy.prototype.close = function() {
    return ipcRenderer.send('ATOM_SHELL_GUEST_WINDOW_MANAGER_WINDOW_CLOSE', this.guestId);
  };

  BrowserWindowProxy.prototype.focus = function() {
    return ipcRenderer.send('ATOM_SHELL_GUEST_WINDOW_MANAGER_WINDOW_METHOD', this.guestId, 'focus');
  };

  BrowserWindowProxy.prototype.blur = function() {
    return ipcRenderer.send('ATOM_SHELL_GUEST_WINDOW_MANAGER_WINDOW_METHOD', this.guestId, 'blur');
  };

  Object.defineProperty(BrowserWindowProxy.prototype, 'location', {
    get: function() {
      return ipcRenderer.sendSync('ATOM_SHELL_GUEST_WINDOW_MANAGER_WINDOW_METHOD', this.guestId, 'getURL');
    },
    set: function(url) {
      return ipcRenderer.sendSync('ATOM_SHELL_GUEST_WINDOW_MANAGER_WINDOW_METHOD', this.guestId, 'loadURL', url);
    }
  });

  BrowserWindowProxy.prototype.postMessage = function(message, targetOrigin) {
    if (targetOrigin == null) {
      targetOrigin = '*';
    }
    return ipcRenderer.send('ATOM_SHELL_GUEST_WINDOW_MANAGER_WINDOW_POSTMESSAGE', this.guestId, message, targetOrigin, location.origin);
  };

  BrowserWindowProxy.prototype["eval"] = function() {
    var args;
    args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    return ipcRenderer.send.apply(ipcRenderer, ['ATOM_SHELL_GUEST_WINDOW_MANAGER_WEB_CONTENTS_METHOD', this.guestId, 'executeJavaScript'].concat(slice.call(args)));
  };

  return BrowserWindowProxy;

})();

if (process.guestInstanceId == null) {
  // Override default window.close.
  window.close = function() {
    return remote.getCurrentWindow().close();
  };
}

// Make the browser window or guest view emit "new-window" event.
window.open = function(url, frameName, features) {
  var feature, guestId, i, ints, j, len, len1, name, options, ref1, ref2, value;
  if (frameName == null) {
    frameName = '';
  }
  if (features == null) {
    features = '';
  }
  options = {};
  ints = ['x', 'y', 'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height', 'zoom-factor'];

  // Make sure to get rid of excessive whitespace in the property name
  ref1 = features.split(/,\s*/);
  for (i = 0, len = ref1.length; i < len; i++) {
    feature = ref1[i];
    ref2 = feature.split(/\s*=/);
    name = ref2[0];
    value = ref2[1];
    options[name] = value === 'yes' || value === '1' ? true : value === 'no' || value === '0' ? false : value;
  }
  if (options.left) {
    if (options.x == null) {
      options.x = options.left;
    }
  }
  if (options.top) {
    if (options.y == null) {
      options.y = options.top;
    }
  }
  if (options.title == null) {
    options.title = frameName;
  }
  if (options.width == null) {
    options.width = 800;
  }
  if (options.height == null) {
    options.height = 600;
  }

  // Resolve relative urls.
  url = resolveURL(url);
  for (j = 0, len1 = ints.length; j < len1; j++) {
    name = ints[j];
    if (options[name] != null) {
      options[name] = parseInt(options[name], 10);
    }
  }
  guestId = ipcRenderer.sendSync('ATOM_SHELL_GUEST_WINDOW_MANAGER_WINDOW_OPEN', url, frameName, options);
  if (guestId) {
    return BrowserWindowProxy.getOrCreate(guestId);
  } else {
    return null;
  }
};

// Use the dialog API to implement alert().
window.alert = function(message, title) {
  var buttons;
  if (title == null) {
    title = '';
  }
  buttons = ['OK'];
  message = message.toString();
  remote.dialog.showMessageBox(remote.getCurrentWindow(), {
    message: message,
    title: title,
    buttons: buttons
  });

  // Alert should always return undefined.
};

// And the confirm().
window.confirm = function(message, title) {
  var buttons, cancelId;
  if (title == null) {
    title = '';
  }
  buttons = ['OK', 'Cancel'];
  cancelId = 1;
  return !remote.dialog.showMessageBox(remote.getCurrentWindow(), {
    message: message,
    title: title,
    buttons: buttons,
    cancelId: cancelId
  });
};

// But we do not support prompt().
window.prompt = function() {
  throw new Error('prompt() is and will not be supported.');
};

if (process.openerId != null) {
  window.opener = BrowserWindowProxy.getOrCreate(process.openerId);
}

ipcRenderer.on('ATOM_RENDERER_WINDOW_VISIBILITY_CHANGE', function (event, isVisible, isMinimized) {
  var hasChanged = _isVisible != isVisible || _isMinimized != isMinimized;
  
  if (hasChanged) {
    _isVisible = isVisible;
    _isMinimized = isMinimized;

    document.dispatchEvent(new Event('visibilitychange'));
  }
});

ipcRenderer.on('ATOM_SHELL_GUEST_WINDOW_POSTMESSAGE', function(event, sourceId, message, sourceOrigin) {
  // Manually dispatch event instead of using postMessage because we also need to
  // set event.source.
  event = document.createEvent('Event');
  event.initEvent('message', false, false);
  event.data = message;
  event.origin = sourceOrigin;
  event.source = BrowserWindowProxy.getOrCreate(sourceId);
  return window.dispatchEvent(event);
});

// Forward history operations to browser.
var sendHistoryOperation = function() {
  var args;
  args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
  return ipcRenderer.send.apply(ipcRenderer, ['ATOM_SHELL_NAVIGATION_CONTROLLER'].concat(slice.call(args)));
};

var getHistoryOperation = function() {
  var args;
  args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
  return ipcRenderer.sendSync.apply(ipcRenderer, ['ATOM_SHELL_SYNC_NAVIGATION_CONTROLLER'].concat(slice.call(args)));
};

window.history.back = function() {
  return sendHistoryOperation('goBack');
};

window.history.forward = function() {
  return sendHistoryOperation('goForward');
};

window.history.go = function(offset) {
  return sendHistoryOperation('goToOffset', offset);
};

Object.defineProperty(window.history, 'length', {
  get: function() {
    return getHistoryOperation('length');
  }
});

// Make document.hidden and document.visibilityState return the correct value.
Object.defineProperty(document, 'hidden', {
  get: function () {
    return _isMinimized || !_isVisible;
  }
});

Object.defineProperty(document, 'visibilityState', {
  get: function() {
    if (_isVisible && !_isMinimized) {
      return "visible";
    } else {
      return "hidden";
    }
  }
});
