Router.configure({
  layoutTemplate: 'main',
  loadingTemplate: 'loading'
});

Todos = new Mongo.Collection('todos');
Lists = new Mongo.Collection('lists');

if(Meteor.isClient){

  Template.todos.helpers({
    'todo': function(){
      var currentList = this._id;
      var currentUser = Meteor.userId();
      return Todos.find({listId: currentList, createdBy: currentUser}, {sort: {createdAt: -1}});
    }
  });

  Template.addTodo.events({
    'submit form': function(event){
      event.preventDefault();
      var todoName = $('[name="todoName"]').val();
      var currentUser = Meteor.userId();
      var currentList = this._id;
      Meteor.call('createListItem', todoName, currentList, function(error, results){
        if(error){
          console.log(error.reason);
        } else{
          $('[name="todoName"]').val('');
        }
      });
      
    }
  });

  Template.todoItem.events({
    'click .delete-todo': function(event){
      event.preventDefault();
      var documentId = this._id;
      var confirm = window.confirm("Delete this task?");
      if(confirm){
        Todos.remove({_id:documentId});        
      }
    },
    'keyup [name=todoItem]': function(event){
      if(event.which == 13 || event.which == 27){
        $(event.target).blur();
      } else{
        var documentId = this._id;
        var todoItem = $(event.target).val();
        Meteor.call('updateListItem', documentId, todoItem);
      }
    },
    'change [type=checkbox]': function(){
      var documentId = this._id;
      var isCompleted = this.completed;
      if(isCompleted){
        Todos.update({_id: documentId}, {$set: {completed: false}});
        console.log("Task marked as incomplete.");
      } else{
        Todos.update({_id: documentId}, {$set: {completed: true}});
        console.log("task marked as complete.");
      }
    }
  });

  Template.todoItem.helpers({
    'checked': function(){
      var isCompleted = this.completed;
      if(isCompleted){
        return "checked";
      } else{
        return "";
      }
    }
  });

  Template.todosCount.helpers({
    'totalTodos': function(){
      var currentList = this._id;
      return Todos.find({listId: currentList}).count();
    },
    'completedTodos': function(){
      var currentList = this._id;
      return Todos.find({ listId: currentList, completed: true }).count();
    }
  });

  Template.addList.events({
    'submit form': function(event){
      event.preventDefault();
      var listName = $('[name=listName]').val();
      Meteor.call('createNewList', listName, function(error, results){
        if(error){
          console.log(error.reason);
        } else{
          Router.go('listPage', {_id: results});
          $('[name=listName]').val('');
        }
      });
    }
  });

  Template.lists.helpers({
    'list': function(){
      var currentUser = Meteor.userId();
      return Lists.find({createdBy: currentUser}, {sort: {name: 1}});
    }
  });

  Template.register.events({
    'submit form': function(event){
      event.preventDefault();
      
    }
  });

  Template.login.events({
    'submit form': function(event){
      event.preventDefault();
      
    }
  });

  Template.navigation.events({
    'click .logout': function(event){
      event.preventDefault();
      Meteor.logout();
      Router.go('login');
    }
  });

  // Validation
  
  $.validator.setDefaults({
    rules:{
        email: {
          required: true,
          email: true
        },
        password:{
          required: true,
          minlength: 6
        }
      },
      messages: {
        email: {
          required: "You must enter an email address.",
          email: "You've entered an invalid email address."
        },
        password: {
          required: "You must enter a password.",
          minlength: "Your password must be at least {0} characters."
        }
      }
  });
  
  // Register
  Template.register.onRendered(function(){
    var validator = $('.register').validate({
      submitHandler: function(event){
        var email = $('[name=email]').val();
        var password = $('[name=password]').val();
        Accounts.createUser({
          email: email,
          password: password
        }, function(error){
          if(error){
            if(error.reason == "Email already exists."){
              validator.showErrors({
                email: "The email alread belongs to a registerd user."
              });
            }
          } else{
            Router.go('home');          
          }
        });
      }
    });
  });

  // login

  Template.login.onRendered(function(){
    var validator = $('.login').validate({
      submitHandler: function(event){
        var email = $('[name=email]').val();
        var password = $('[name=password]').val();
        Meteor.loginWithPassword(email, password, function(error){
          if(error){
            if(error.reason == "User not found"){
              validator.showErrors({
                email: error.reason
              });
            }
            if(error.reason == "Incorrect Password"){
              validator.showErrors({
                password: error.reason
              });
            }
          } else{
            var currentRoute = Router.current().route.getName();

            if(currentRoute == "login"){
              Router.go("home");
            }
          }
        });
      }
    });
  });
}

// Server side
if(Meteor.isServer){

  function defaultName(currentUser) {
      var nextLetter = 'A'
      var nextName = 'List ' + nextLetter;
      while (Lists.findOne({ name: nextName, createdBy: currentUser })) {
          nextLetter = String.fromCharCode(nextLetter.charCodeAt(0) + 1);
          nextName = 'List ' + nextLetter;
      }
      return nextName;
  }

  Meteor.publish('lists', function(){
    var currentUser = this.userId;
    return Lists.find({createdBy: currentUser});
  });

  Meteor.publish('todos', function(currentList){
    var currentUser = this.userId;
    return Todos.find({createdBy: currentUser, listId: currentList});
  });

  Meteor.methods({
    'createNewList': function(listName){
      var currentUser = Meteor.userId();
      check(listName, String);
      if(listName == ""){
        listName = defaultName(currentUser);
      }
      var data = {
        name: listName,
        createdBy: currentUser
      }
      if(!currentUser){
        throw new Meteor.Error("not-logged-in", "You're not logged in.");
      } 
      return Lists.insert(data);

    },
    'createListItem': function(todoName, currentList){

      check(todoName, String);
      check(currentList, String);

      var currentUser = Meteor.userId();
      
      var data = {
        name: todoName,
        completed: false,
        createdAt: new Date(),
        createdBy: currentUser,
        listId: currentList
      }
      if(!currentUser){
        throw new Meteor.Error("not-logged-in", "You're not logged in.");
      }

      var currentList = Lists.findOne(currentList);
      if(currentList.createdBy != currentUser){
        throw new Meteor.Error("invalid-user", "You don't own that list.");
      }

      return Todos.insert(data);
    },
    'updateListItem': function(documentId, todoItem){
      check(todoItem, String);
      var currentUser = Meteor.userId();
      var data = {
        _id: documentId,
        createdBy: currentUser
      }
      if(!currentUser){
        throw new Meteor.Error("not-logged-in", "You're not logged in.");
      }
      Todos.update(data,  {$set: { name: todoItem }});
    }
  });
}


// Routes
Router.route('/', {
  name:'home',
  template: 'home',
  waitOn: function(){
    return Meteor.subscribe('lists');
  }
});
Router.route('/register');
Router.route('/login');
Router.route('/list/:_id', {
  name: 'listPage',
  template: 'listPage',
  data: function(){
    var currentList = this.params._id;
    return Lists.findOne({_id: currentList});
  },
  onBeforeAction: function(){
    var currentUser = Meteor.userId();
    if(currentUser){
      this.next();
    } else{
      this.render("login");
    }
  },
  waitOn: function(){
    var currentList = this.params._id;
    return [Meteor.subscribe('lists'), Meteor.subscribe('todos', currentList)];
  }
});