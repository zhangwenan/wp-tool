# wp-tool

# Usage
```javascript
var wp_util = require('wp-tool');

var wp = wp_util.create({
  domain: 'www.xxxx.com',
  user:'test',
  password:'hello1233'
});

wp.new_post({
  title:'哈哈哈',
  content:'内容受够了傻瓜了',
  seo_title:'SEO haha title',
  seo_description:'SEO hoho desc',
  seo_keywords:'SEO nice keywords',
  //type:'',
  category:1,
  tag:''
});
```