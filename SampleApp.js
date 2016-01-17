
// Route configurations.
Router.route('/map');
Router.route('/lendlib');
Router.route('home', {
    path: '/'
});
Router.configure({
   layoutTemplate: 'layout'
});

lists = new Mongo.Collection("lists");

if (Meteor.isClient) {
    var MAP_ZOOM = 15;

    Meteor.startup(function() {  
          GoogleMaps.load();
    });

    Template.map.helpers({  
      geolocationError: function() {
        var error = Geolocation.error();
        return error && error.message;
      },
      mapOptions: function() {
        var latLng = Geolocation.latLng();
        
        // Initialize the map once we have the latLng.
        if (GoogleMaps.loaded() && latLng) {
          return {
            center: new google.maps.LatLng(latLng.lat, latLng.lng),
            zoom: MAP_ZOOM
          };
        }
      }

    });

    Template.navItems.helpers({
      activeIfTemplateIs: function (template) {
        var currentRoute = Router.current();
        return currentRoute &&
          template === currentRoute.lookupTemplate() ? 'active' : '';
      }
    });

    Template.map.onCreated(function() {  
      var self = this;

      GoogleMaps.ready('map', function(map) {
        var marker;

        // Create and move the marker when latLng changes.
        self.autorun(function() {
          var latLng = Geolocation.latLng();
          if (! latLng)
            return;

          // If the marker doesn't yet exist, create it.
          if (! marker) {
            marker = new google.maps.Marker({
              position: new google.maps.LatLng(latLng.lat, latLng.lng),
              map: map.instance
            });
          }
          // The marker already exists, so we'll just change its position.
          else {
            marker.setPosition(latLng);
          }

          // Center and zoom the map view onto the current position.
          map.instance.setCenter(marker.getPosition());
          map.instance.setZoom(MAP_ZOOM);
        });
      });
    });

  // We are declaring the 'adding_category' flag
  Session.set('adding_category', false);

  Template.categories.helpers({
    lists: function () {
      return lists.find({}, { sort: { Category: 1 }});
    },
    new_cat: function(){
      //returns true if adding_category has been assigned
      //a value of true
      return Session.equals('adding_category',true);
    },
    list_status: function() {
      if (Session.equals('current_list', this._id))
        return " btn-info";
      else
        return "btn-primary";
    }
  });

  function focusText(i, val) {
      i.focus(); 
      i.value = val ? val : "";
      i.select(); 
  }

  function selectCategory(e, t) {
    Session.set('current_list', this._id);
  }

  Template.categories.events({
    'click #btnNewCat': function (e, t) {
      Session.set('adding_category', true);
      Tracker.flush();
      focusText(t.find("#add-category"));
    },
    'keyup #add-category': function (e,t){
      if (e.which === 13)
      {
        var catVal = String(e.target.value || "");
        if (catVal)
        {
          lists.insert({Category:catVal});
          Session.set('adding_category', false);
        }
      }
    },
    'focusout #add-category': function(e,t){
      Session.set('adding_category',false);
    },
    'click .category': selectCategory
  });


  function addItem(list_id, item_name) {
    if (!item_name && !list_id) return;
    lists.update({
      _id: list_id
    },{
      $addToSet: {
        items: {Name: item_name}
      }
    });
  };

  function removeItem(list_id, item_name) {
    if (!item_name && !list_id)
      return;
    lists.update({
      _id:list_id
    }, {
      $pull: {
        items: {
          Name: item_name
        }
      }
    });
  };

  function getItemIndex(listId, itemName) {
    var l = lists.findOne({
      "_id": listId
    });
    if (l && l.items) {
      for (var i = 0; i < l.items.length; i++) {
        if (l.items[i].Name === itemName) {
          return i;
          break;
        }
      }
    }
    // return invalid index
    return -1;
  }


  function updateLendee(listId, itemName, lendeeName) {
      var idx = getItemIndex(listId, itemName);
      if (idx !== -1 ) {
          var updateItem = {};
          updateItem['items.' + idx + '.LentTo'] = lendeeName;
          lists.update({
              '_id': listId
          }, {
              $set: updateItem
          });
      }
  };

  function updatePicture(listId, itemName, picUri) {
      var idx = getItemIndex(listId, itemName);
      if (idx !== -1 ) {
          var updateItem = {};
          updateItem['items.' + idx + '.Picture'] = picUri;
          lists.update({
              '_id': listId
          }, {
              $set: updateItem
          });
      }
  };

  Template.list.helpers({
    items: function () {
      if (Session.equals('current_list', null)) {
        return null;
      } else {
        var cats = lists.findOne({
          _id: Session.get('current_list')
        });
        if (cats && cats.items) {
          for (var i = 0; i < cats.items.length; i++) {
            var itm = cats.items[i];
            itm.Lendee = itm.LentTo ? itm.LentTo : "free";
            itm.LendClass = itm.LentTo ? "label-danger" : "label-success";
          }
          return cats.items;
        }
      }
    },
    list_selected: function () {
      return ((Session.get('current_list') != null) &&
        (!Session.equals('current_list', null)));
    },
    list_adding: function () {
      return (Session.equals('list_adding', true));
    },
    lendee_editing: function () {
      return (Session.equals('lendee_input', this.Name));
    }
    //photo: function(){
        //return Session.get('photo');
    //}
  });

  Template.list.events({
    'click #btnAddItem': function (e, t) {
      Session.set('list_adding', true);
      Tracker.flush();
      focusText(t.find('#item_to_add'));
    },
    'keyup #item_to_add': function (e, t) {
      if (e.which === 13) {
        addItem(Session.get('current_list'), e.target.value);
        Session.set('list_adding', false);
      }
    },
    'focusout #item_to_add': function (e, t) {
      Session.set('list_adding', false);
    },
    'click .delete_item': function (e, t) {
      removeItem(Session.get('current_list'), e.target.id);
    },
    'click .lendee': function (e, t) {
      if (Meteor.isCordova) {
          var itemName = this.Name;
          navigator.contacts.pickContact(function (contact) {
              navigator.notification.alert("Item Name:" + itemName);
              var name = contact.displayName;
              navigator.notification.alert("Contact Name:" + name);
              updateLendee(Session.get('current_list'), itemName, name);
          }, function (err) {
              navigator.notification.alert(err, null, 'Failure');
          });
      } else {
          Session.set('lendee_input', this.Name);
          Tracker.flush();
          focusText(t.find('#edit_lendee'), this.LentTo);
      }
    },
    'keyup #edit_lendee': function (e, t) {
      if (e.which === 13) {
        updateLendee(Session.get('current_list'), this.Name, e.target.value);
        Session.set('lendee_input', null);
      } else if (e.which === 27) {
        Session.set('lendee_input', null);
      }
    },
    'click .take_picture': function (e, t) {
        console.log("Take Picture Clicked");
        itemName = this.Name;
        MeteorCamera.getPicture({}, function(error, data){
            updatePicture(Session.get('current_list'), itemName, data);
        });
        //if (Meteor.isCordova) {
            //// accepts a file URI which is saved in the Session photo variable.
            //function onSuccess(imageData) {
                //navigator.notification.alert("Camera Success");
                //navigator.notification.alert(imageData, null, "Camera Success");
                //var image = document.getElementById('myImage');
                //image.src = imageData
            //}
//
            //function onFail(message) {
                //navigator.notification.alert(message, null, "Camera Failure");
            //}   
//
            //navigator.notification.alert("Taking Picture");
            //navigator.camera.getPicture(onSuccess, onFail, { 
                //quality: 50,
                //sourceType: Camera.PictureSourceType.CAMERA,
                //destinationType: Camera.DestinationType.FILE_URI
            //});
        //}
    }
  });


}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
