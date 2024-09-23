---
template: project
title: Weby CMS
description: Weby CMS is a headless content management system written in PHP and Vue.
date: 2021-07-23
author: Yendric
---

Weby CMS is a headless content management system written in PHP and Vue.

It offers an easy to use API for creating a custom control panel for your website.
It integrates nicely with Laravel, leveraging PHPStan to validate database fieldnames and offering helper functions for rendering Weby data in your blade frontend. There's also a Spatie medialibrary integration, allowing users to easily manage media collections.

An example use of the Weby form API:

```php
    protected static function form(BaseFormBuilder $builder): Builder
    {
        return $builder
            ->title('Products')
            ->inputs([
                TextInput::make('name', 'Name')
                    ->validate(["max:10"])
                    ->required(),
                WysiwygInput::make('description', 'Description')->required(),
                RelationInput::make(
                    Merken::class,
                    'brand',
                    'name',
                    'Brand'
                )->required(),
                NumberInput::make(
                    'price',
                    'Price (euro)'
                )->required(),
                ImageInput::make('default', "Pictures")
                    ->allowMultiple()
                    ->required(),
            ]);
    }

```

Likewise, its also possible to create tables, popups and more. Weby is also built in an extensible matter, allowing anyone to extend its functionality. It's possible to add form inputs, table cell types and custom dashboard pages.

Below you can find some screenshots of the dashboard in action:
![Weby dashboard](/assets/img/weby-dashboard.png)
![Weby table](/assets/img/weby-table.png)
![Weby edit page](/assets/img/weby-edit.png)
![Weby settings page](/assets/img/weby-settings.png)
![Weby share modal](/assets/img/weby-share.png)
