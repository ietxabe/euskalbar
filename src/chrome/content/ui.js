with (euskalbarLib) {

  euskalbar.ui = {

    /* Euskalbar UI initialization */
    init: function () {
      // Create and populate the Dictionaries menu
      this.initDictsMenu();
    },


    initDictsMenu: function () {
      var dictsMenu = this.createDictsMenu();

      this.initMenu("euskalbar-menu", dictsMenu);
      this.initMenu("appmenu_euskalbar", dictsMenu);
    },


    /* Dynamically creates the dictionaries menu based on the data
     * available in euskalbar.dicts.menu
     *
     * TODO: allow nested categories by making this a recursive function
     * TODO: only create the menu when asked (onPopupShowing)
     * TODO: first try to load the dictionaries' JSON remotely
     * TODO: use localized texts for 'name'
     * TODO: slugify names when using them as IDs
     */
    createDictsMenu: function () {
      var items = euskalbar.dicts.menu;
      var menuPopup = document.createElement("menupopup");

      for (var i=0; i<items.length; i++) {
        var menu = document.createElement("menu");
        menu.setAttribute("label", items[i].cat);
        menu.setAttribute("id", "euskalbar-menu-" + items[i].cat);

        var submenu = document.createElement("menupopup");
        submenu.setAttribute("id", "euskalbar-menuPopup-" + items[i].cat);

        var dicts = items[i].dicts;
        for (var j=0; j<dicts.length; j++) {
          var dict = dicts[j];

          if (dict.hasOwnProperty("sep")) {
            var item = document.createElement("menuseparator");
          } else {
            var item = document.createElement("menuitem");
            item.setAttribute("label", dict.name);
            item.setAttribute("oncommand",
                              "euskalbar.openURL('" + dict.url + "', '" +
                                                 dict.name + "')");
          }

          submenu.appendChild(item);
        }

        menu.appendChild(submenu);
        menuPopup.appendChild(menu);
      }

      return menuPopup;
    },


    /* Initializes a menu with id 'parentMenuId' by recursively cloning
     * the 'popupMenu' DOM node */
    initMenu: function (parentMenuId, popupMenu) {
      var parentMenu = $(parentMenuId);

      if (!parentMenu) {
        return;
      }

      parentMenu.appendChild(popupMenu.cloneNode(true));
    },


    /* Appends the Euskalbar button to the navigation bar */
    appendButtonToToolbar: function() {
      // Get the current navigation bar button set (a string of button IDs) and append
      // the ID of the Euskalbar button into it
      var euskalbarButtonId = "euskalbar-button";
      var navBarId = "nav-bar";
      var navBar = $(navBarId);

      var currentSet = navBar.currentSet;

      // Append only if the button is not already there
      var curSet = currentSet.split(",");
      if (curSet.indexOf(euskalbarButtonId) == -1) {
        var set = curSet.concat(euskalbarButtonId);

        navBar.setAttribute("currentset", set.join(","));
        document.persist(navBarId, "currentset");

        try {
          BrowserToolboxCustomizeDone(true);
        } catch (e) {
        }
      }

      // In case it's hidden, show the navigation bar
      navBar.setAttribute("collapsed", false);
      document.persist(navBarId, "collapsed");
    },

  };

}