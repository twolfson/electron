const ipcMain = require('electron').ipcMain;
const BrowserWindow = require('electron').BrowserWindow;

var hasProp = {}.hasOwnProperty;
var slice = [].slice;
var frameToGuest = {};

// Copy attribute of |parent| to |child| if it is not defined in |child|.
var mergeOptions = function(child, parent) {
  var key, value;
  for (key in parent) {
    if (!hasProp.call(parent, key)) continue;
    value = parent[key];
    if (!(key in child)) {
      if (typeof value === 'object') {
        child[key] = mergeOptions({}, value);
      } else {
        child[key] = value;
      }
    }
  }
  return child;
};

// Merge |options| with the |embedder|'s window's options.
var mergeBrowserWindowOptions = function(embedder, options) {
  if (embedder.browserWindowOptions != null) {

    // Inherit the original options if it is a BrowserWindow.
    mergeOptions(options, embedder.browserWindowOptions);
  } else {

    // Or only inherit web-preferences if it is a webview.
    if (options.webPreferences == null) {
      options.webPreferences = {};
    }
    mergeOptions(options.webPreferences, embedder.getWebPreferences());
  }
  return options;
};

// Create a new guest created by |embedder| with |options|.
var createGuest = function(embedder, url, frameName, options) {
  var closedByEmbedder, closedByUser, guest, guestId, ref1;
  guest = frameToGuest[frameName];
  if (frameName && (guest != null)) {
    guest.loadURL(url);
    return guest.id;
  }

  // Remember the embedder window's id.
  if (options.webPreferences == null) {
    options.webPreferences = {};
  }
  options.webPreferences.openerId = (ref1 = BrowserWindow.fromWebContents(embedder)) != null ? ref1.id : void 0;
  guest = new BrowserWindow(options);
  guest.loadURL(url);

  // When |embedder| is destroyed we should also destroy attached guest, and if
  // guest is closed by user then we should prevent |embedder| from double
  // closing guest.
  guestId = guest.id;
  closedByEmbedder = function() {
    guest.removeListener('closed', closedByUser);
    return guest.destroy();
  };
  closedByUser = function() {
    embedder.send("ATOM_SHELL_GUEST_WINDOW_MANAGER_WINDOW_CLOSED_" + guestId);
    return embedder.removeListener('render-view-deleted', closedByEmbedder);
  };
  embedder.once('render-view-deleted', closedByEmbedder);
  guest.once('closed', closedByUser);
  if (frameName) {
    frameToGuest[frameName] = guest;
    guest.frameName = frameName;
    guest.once('closed', function() {
      return delete frameToGuest[frameName];
    });
  }
  return guest.id;
};

// Routed window.open messages.
ipcMain.on('ATOM_SHELL_GUEST_WINDOW_MANAGER_WINDOW_OPEN', function() {
  var args, event, frameName, options, url;
  event = arguments[0], args = 2 <= arguments.length ? slice.call(arguments, 1) : [];
  url = args[0], frameName = args[1], options = args[2];
  options = mergeBrowserWindowOptions(event.sender, options);
  event.sender.emit('new-window', event, url, frameName, 'new-window', options);
  if ((event.sender.isGuest() && !event.sender.allowPopups) || event.defaultPrevented) {
    return event.returnValue = null;
  } else {
    return event.returnValue = createGuest(event.sender, url, frameName, options);
  }
});

ipcMain.on('ATOM_SHELL_GUEST_WINDOW_MANAGER_WINDOW_CLOSE', function(event, guestId) {
  var ref1;
  return (ref1 = BrowserWindow.fromId(guestId)) != null ? ref1.destroy() : void 0;
});

ipcMain.on('ATOM_SHELL_GUEST_WINDOW_MANAGER_WINDOW_METHOD', function() {
  var args, guestId, method, ref1;
  event = arguments[0], guestId = arguments[1], method = arguments[2], args = 4 <= arguments.length ? slice.call(arguments, 3) : [];
  return event.returnValue = (ref1 = BrowserWindow.fromId(guestId)) != null ? ref1[method].apply(ref1, args) : void 0;
});

ipcMain.on('ATOM_SHELL_GUEST_WINDOW_MANAGER_WINDOW_POSTMESSAGE', function(event, guestId, message, targetOrigin, sourceOrigin) {
  var guestContents, ref1, ref2, sourceId;
  sourceId = (ref1 = BrowserWindow.fromWebContents(event.sender)) != null ? ref1.id : void 0;
  if (sourceId == null) {
    return;
  }
  guestContents = (ref2 = BrowserWindow.fromId(guestId)) != null ? ref2.webContents : void 0;
  if ((guestContents != null ? guestContents.getURL().indexOf(targetOrigin) : void 0) === 0 || targetOrigin === '*') {
    return guestContents != null ? guestContents.send('ATOM_SHELL_GUEST_WINDOW_POSTMESSAGE', sourceId, message, sourceOrigin) : void 0;
  }
});

ipcMain.on('ATOM_SHELL_GUEST_WINDOW_MANAGER_WEB_CONTENTS_METHOD', function() {
  var args, guestId, method, ref1, ref2;
  guestId = arguments[1], method = arguments[2], args = 4 <= arguments.length ? slice.call(arguments, 3) : [];
  return (ref1 = BrowserWindow.fromId(guestId)) != null ? (ref2 = ref1.webContents) != null ? ref2[method].apply(ref2, args) : void 0 : void 0;
});
