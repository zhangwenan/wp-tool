//var base = require('./base');

// var cookie_util = require('cookie-util');
var http_tools = require('http-tools');

var http = require('http');
var https = require('https');
var mkdirp = require('mkdirp');
var fs = require("fs");
var rest = require('restler');
var log4js = require('log4js');
var cheerio = require('cheerio');
var querystring = require('querystring');
var iconv = require('iconv-lite');
//var zlib = require('zlib');

var request = require('request');
var file_cookie_store = require('tough-cookie-filestore');
var j = request.jar(new file_cookie_store('cookies.json'));
request = request.defaults({ jar : j });


// 创建日志文件夹
mkdirp(process.cwd() + '/logs', function (err) {
  if (err) console.error(err);
  //else console.log('验证码文件夹创建成功!');
});


// 日志配置
log4js.configure({
  "appenders":[
    {
      "type": "dateFile",
      "filename": "logs/wp_tool.log",
      "pattern": "-yyyy-MM-dd",
      "alwaysIncludePattern": false,
      "category": "wp_tool"
    },
    {
      "type": "console",
      "category": "console"
    }
  ]
});
var wp_logger = log4js.getLogger("wp_tool");
var console_logger = log4js.getLogger("console");


function wp(conf){
  this.user = conf.user;
  this.password = conf.password;
  this.domain = conf.domain;
  this.msg = '';

  this.login_url = 'http://' + conf.domain + '/wp-login.php';
}

wp.prototype.getCurrTime = function(){
  var now = new Date();
  var ret = '';
  ret += now.getFullYear() + '年';
  ret += (now.getMonth() + 1) + '月';
  ret += now.getDate() + '日 ';
  ret += now.getHours() + '时';
  ret += now.getMinutes() + '分';
  ret += now.getSeconds() + '秒';
  return ret;
}


wp.prototype.validate = function(){
  var self = this;

  var p = new Promise(function(resolve, reject){

    self.msg = self.getCurrTime() + ',[' + self.user + ']开始校验登陆状态';
    wp_logger.info(self.msg);
    console_logger.info(self.msg);

    request({
        url: 'http://'+self.domain+'/wp-admin/',
        jar: j
      },
      function(err,httpResponse,body){
        var reg = new RegExp(self.user, "i");
        if(reg.test(body)){

          self.msg = self.getCurrTime() + ',[' + self.user + ']Cookies依然有效!';
          wp_logger.info(self.msg);
          console_logger.info(self.msg);

          resolve(true);
        }
        else{
          self.msg = self.getCurrTime() + ',[' + self.user + ']Cookies已失效!';
          wp_logger.info(self.msg);
          console_logger.info(self.msg);

          resolve(false);

        }
      }
    );
  });

  return p;
};


wp.prototype.login = function(){
  var self = this;


  var p = function(is_valid){
    return new Promise(function(resolve, reject){
      if(!is_valid){

        var post_obj = {
          log:self.user,
          pwd:self.password,
          'wp-submit':'登录',
          'redirect_to':'http://'+self.domain+'/wp-admin/',
          'testcookie':1
        };

        self.msg = self.getCurrTime() + ',[' + self.user + ']开始登陆' + self.domain;
        wp_logger.info(self.msg);
        console_logger.info(self.msg);

        request.post({
            url:self.login_url,
            form: post_obj,
            jar: j
          },
          function(err,httpResponse,body){

            if(!err){

              self.msg = self.getCurrTime() + ',[' + self.user + ']成功登陆' + self.domain;
              wp_logger.info(self.msg);
              console_logger.info(self.msg);

              resolve();
            }
            else{

              self.msg = self.getCurrTime() + ',[' + self.user + ']登陆' + self.domain + '失败';
              wp_logger.info(self.msg);
              console_logger.info(self.msg);

              reject();
            }
          }
        );
      }
      else{
        self.msg = self.getCurrTime() + ',[' + self.user + ']成功登陆' + self.domain;
        wp_logger.info(self.msg);
        console_logger.info(self.msg);

        resolve();
      }
    });
  };

  var p2 = self.validate().then(p);

  return p2;
};


/**
 * 发布新文章
 * @param article
 */
wp.prototype.new_post = function(article){

  var self = this;

  var p_get_user_info = function(){
    return new Promise(function(resolve, reject){

      request.get({
          url:'http://'+self.domain+'/wp-admin/post-new.php',
          jar: j
        },
        function(err,httpResponse,body){

          if(!err){
            var $ = cheerio.load(body);
            self.user_id = $('input[name=user_ID]').val();
            self._wpnonce = $('input[name=_wpnonce]').val();
            self.post_author = $('input[name=post_author]').val();
            self.closedpostboxesnonce = $('input[name=closedpostboxesnonce]').val();
            self.advanced_view = $('input[name=advanced_view]').val();
            self.post_ID = $('input[name=post_ID]').val();
            self['meta-box-order-nonce'] = $('input[name="meta-box-order-nonce"]').val();
            self['_ajax_nonce-add-category'] = $('input[name="_ajax_nonce-add-category"]').val();
            self['_ajax_nonce-add-meta'] = $('input[name="_ajax_nonce-add-meta"]').val();
            self['nonce-aioseop-edit'] = $('input[name="nonce-aioseop-edit"]').val();
            resolve();
          }
          else{
            reject();
          }
        }
      );
    });

  };

  var post = function(){
    return new Promise(function(resolve, reject){

      self.msg = self.getCurrTime() + ',[' + self.user + ']开始发布文章到' + self.domain;
      wp_logger.info(self.msg);
      console_logger.info(self.msg);

      var now = new Date();
      var num_fix = function(num){
        if(num<10){
          return '0' + num;
        }
        else{
          return num;
        }
      };
      var post_obj = {
        _wpnonce:self._wpnonce,
        _wp_http_referer:'/wp-admin/post-new.php',
        user_ID:self.user_id,
        action:'editpost',
        originalaction:'editpost',
        post_author:self.post_author,
        post_type:'post',
        original_post_status:'auto-draft',
        referredby:'http://'+self.domain+'/wp-admin/post-new.php',
        _wp_original_http_referer:'http://'+self.domain+'/wp-admin/post-new.php',
        auto_draft:'',
        post_ID:self.post_ID,
        'meta-box-order-nonce':self['meta-box-order-nonce'],
        closedpostboxesnonce:self.closedpostboxesnonce,
        post_title:article.title,
        samplepermalinknonce:self.samplepermalinknonce,
        content:article.content,
        'wp-preview':'',
        hidden_post_status:'draft',
        post_status:'draft',
        hidden_post_password:'',
        hidden_post_visibility:'public',
        visibility:'public',
        post_password:'',
        aa:now.getFullYear(),
        mm:num_fix(now.getMonth()+1),
        jj:num_fix(now.getDate()),
        hh:num_fix(now.getHours()),
        mn:num_fix(now.getMinutes()),
        ss:num_fix(now.getSeconds()),
        hidden_mm:num_fix(now.getMonth()+1),
        cur_mm:num_fix(now.getMonth()+1),
        hidden_jj:num_fix(now.getDate()),
        cur_jj:num_fix(now.getDate()),
        hidden_aa:now.getFullYear(),
        cur_aa:now.getFullYear(),
        hidden_hh:num_fix(now.getHours()),
        cur_hh:num_fix(now.getHours()),
        hidden_mn:num_fix(now.getMinutes()),
        cur_mn:num_fix(now.getMinutes()),
        original_publish:'发布',
        publish:'发布',
        post_format:0,
        'post_category[]':0,
        'post_category[]':2,
        newcategory:'新分类目录名',
        newcategory_parent:-1,
        '_ajax_nonce-add-category':self['_ajax_nonce-add-category'],
        'tax_input[post_tag]':'',
        'newtag[post_tag]':'',
        excerpt:'',
        trackback_url:'',
        metakeyselect:'#NONE#',
        metakeyinput:'',
        metavalue:'',
        '_ajax_nonce-add-meta':self['_ajax_nonce-add-meta'],
        advanced_view:self.advanced_view,
        comment_status:'open',
        ping_status:'open',
        post_name:'',
        post_author_override:self.post_author,
        aiosp_edit:'aiosp_edit',
        'nonce-aioseop-edit':self['nonce-aioseop-edit'],
        aiosp_title:article.seo_title,
        length1:article.seo_title.length + 12,
        aiosp_description:article.seo_description,
        length2:article.seo_description.length,
        aiosp_keywords:article.seo_keywords
      };


      request.post({
          url: 'http://' + self.domain + '/wp-admin/post.php',
          form: post_obj,
          jar: j
        },
        function(err,httpResponse,body){
          if(err){
            //reject();
            self.msg = self.getCurrTime() + ',[' + self.user + ']开始发布文章失败';
            wp_logger.info(self.msg);
            console_logger.info(self.msg);
          }
          else{
            // 302跳转到 http://xxxx.com/wp-admin/post.php?post=18&action=edit&message=6

            self.msg = self.getCurrTime() + ',[' + self.user + ']发布文章成功';
            wp_logger.info(self.msg);
            console_logger.info(self.msg);

            resolve();
          }
        }
      );
    })
  };

  self.login().then(p_get_user_info).then(post);
};


module.exports = {
  create: function(conf){
    return new wp(conf);
  }
};